from __future__ import annotations

from decimal import Decimal
from http import HTTPStatus
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse
from qpay_client.v2.schemas import QPayDeeplink

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.payments.models import Payment
from backend.payments.services import create_payment_invoice
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

SALE_PRICE = 100
RENT_PRICE = 50
RENT_DURATION = 3


class FakeQPayClient:
    """Stand-in for QPayClient — no network, deterministic responses."""

    def __init__(self, *, paid: bool = True):
        self.paid = paid
        self.cancelled: list[str] = []

    def invoice_create(self, request):
        return SimpleNamespace(
            invoice_id=f"INV-{request.sender_invoice_no}",
            qPay_shortUrl="https://qpay.mn/s/abc",
            qr_text="QR-TEXT",
            qr_image="QR-IMAGE-BASE64",
            urls=[
                QPayDeeplink(
                    name="Khan bank",
                    description="Хаан банк",
                    logo="https://qpay.mn/q/logo/khanbank.png",
                    link="khanbank://q?qPay_QRcode=QR-TEXT",
                ),
            ],
            subscription=None,
        )

    def payment_check(self, request):
        if self.paid:
            return SimpleNamespace(count=1, paid_amount=Decimal("100"), rows=[])
        return SimpleNamespace(count=0, paid_amount=None, rows=[])

    def invoice_cancel(self, invoice_id: str) -> int:
        self.cancelled.append(invoice_id)
        return 200


def _sale_listing(price=Decimal(SALE_PRICE)):
    seller = UserFactory.create()
    account = Account.objects.create(
        user=seller,
        title="Dragon account",
        price=price,
        kind=Account.SALE,
    )
    return (seller, account)


def _rent_listing(price=Decimal(RENT_PRICE)):
    seller = UserFactory.create()
    account = Account.objects.create(
        user=seller,
        title="Rent dragon",
        price=price,
        kind=Account.RENT,
        rental_unit=Account.DAY,
    )
    return (seller, account)


def _invoice_url() -> str:
    return reverse("api:create_invoice")


def _patch_client(monkeypatch, *, paid: bool = True) -> FakeQPayClient:
    fake = FakeQPayClient(paid=paid)
    monkeypatch.setattr("backend.payments.services.get_qpay_client", lambda: fake)
    return fake


def test_invoice_happy_path_sale(client: Client, monkeypatch):
    _patch_client(monkeypatch)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    client.force_login(buyer)

    response = client.post(
        _invoice_url(),
        data={"account_id": account.pk, "kind": "sale"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.content
    body = response.json()
    assert body["account_id"] == account.pk
    assert body["amount"] == SALE_PRICE
    assert body["status"] == "pending"
    assert body["invoice_id"].startswith("INV-")
    assert body["qpay_short_url"] == "https://qpay.mn/s/abc"
    assert body["qpay_qr_image"] == "QR-IMAGE-BASE64"
    assert len(body["banks"]) == 1
    assert body["banks"][0]["name"] == "Khan bank"
    assert body["banks"][0]["logo"] == "https://qpay.mn/q/logo/khanbank.png"
    # Pay-then-claim: listing stays available until money arrives.
    account.refresh_from_db()
    assert account.status == Account.AVAILABLE
    assert EscrowTransaction.objects.filter(account=account).count() == 0


def test_invoice_reuses_pending_payment(client: Client, monkeypatch):
    _patch_client(monkeypatch)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    client.force_login(buyer)

    first = client.post(
        _invoice_url(),
        data={"account_id": account.pk, "kind": "sale"},
        content_type="application/json",
    )
    second = client.post(
        _invoice_url(),
        data={"account_id": account.pk, "kind": "sale"},
        content_type="application/json",
    )

    assert first.json()["id"] == second.json()["id"]
    assert Payment.objects.filter(account=account, status=Payment.PENDING).count() == 1


def test_invoice_own_listing_rejected(client: Client, monkeypatch):
    _patch_client(monkeypatch)
    seller, account = _sale_listing()
    client.force_login(seller)

    response = client.post(
        _invoice_url(),
        data={"account_id": account.pk, "kind": "sale"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_invoice_rent_amount(client: Client, monkeypatch):
    _patch_client(monkeypatch)
    _, account = _rent_listing()
    renter = UserFactory.create()
    client.force_login(renter)

    response = client.post(
        _invoice_url(),
        data={"account_id": account.pk, "kind": "rent", "duration": RENT_DURATION},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.content
    assert response.json()["amount"] == RENT_PRICE * RENT_DURATION


def test_callback_paid_claims_listing(client: Client, monkeypatch):
    _patch_client(monkeypatch, paid=True)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    payment = create_payment_invoice(account.pk, buyer)

    response = client.get(
        f"/api/payments/qpay/callback/?payment_id={payment.sender_invoice_no}",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.content == b"SUCCESS"
    payment.refresh_from_db()
    assert payment.status == Payment.PAID
    assert payment.paid_amount == Decimal("100")
    account.refresh_from_db()
    assert account.status == Account.SOLD
    assert account.buyer_id == buyer.pk
    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_callback_unpaid_stays_pending(client: Client, monkeypatch):
    _patch_client(monkeypatch, paid=False)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    payment = create_payment_invoice(account.pk, buyer)

    response = client.get(
        f"/api/payments/qpay/callback/?payment_id={payment.sender_invoice_no}",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.content == b"SUCCESS"
    payment.refresh_from_db()
    assert payment.status == Payment.PENDING
    account.refresh_from_db()
    assert account.status == Account.AVAILABLE


def test_callback_unknown_payment_id(client: Client):
    response = client.get("/api/payments/qpay/callback/?payment_id=NOPE")

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_callback_is_idempotent(client: Client, monkeypatch):
    _patch_client(monkeypatch, paid=True)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    payment = create_payment_invoice(account.pk, buyer)
    url = f"/api/payments/qpay/callback/?payment_id={payment.sender_invoice_no}"

    assert client.get(url).status_code == HTTPStatus.OK
    assert client.post(url).status_code == HTTPStatus.OK

    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_status_poll_pays_and_claims(client: Client, monkeypatch):
    fake = _patch_client(monkeypatch, paid=False)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    payment = create_payment_invoice(account.pk, buyer)
    client.force_login(buyer)

    url = reverse("api:payment_status", kwargs={"payment_id": payment.pk})
    pending = client.get(url)
    assert pending.json()["status"] == "pending"

    fake.paid = True
    paid = client.get(url)

    assert paid.json()["status"] == "paid"
    account.refresh_from_db()
    assert account.status == Account.SOLD


def test_cancel_payment(client: Client, monkeypatch):
    fake = _patch_client(monkeypatch)
    _, account = _sale_listing()
    buyer = UserFactory.create()
    payment = create_payment_invoice(account.pk, buyer)
    client.force_login(buyer)

    url = reverse("api:payment_cancel", kwargs={"payment_id": payment.pk})
    response = client.post(url)

    assert response.status_code == HTTPStatus.OK, response.content
    assert response.json()["status"] == "cancelled"
    assert fake.cancelled == [payment.qpay_invoice_id]
    account.refresh_from_db()
    assert account.status == Account.AVAILABLE
