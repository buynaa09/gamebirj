from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.accounts.services import NotBuyerError
from backend.accounts.services import OrderNotFoundError
from backend.accounts.services import OrderStateError
from backend.accounts.services import buy_account
from backend.accounts.services import release_escrow
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PRICE = 100


def _sold_listing():
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon account", price=PRICE)
    order = buy_account(account.pk, buyer)
    return (seller, buyer, account, order)


def _order_url(account_id: int) -> str:
    return reverse("api:get_order", kwargs={"account_id": account_id})


def _confirm_url(account_id: int) -> str:
    return reverse("api:confirm_receipt", kwargs={"account_id": account_id})


def test_buyer_confirm_releases_to_seller(client: Client):
    _, buyer, account, _ = _sold_listing()
    client.force_login(buyer)

    response = client.post(_confirm_url(account.pk))

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["account_id"] == account.pk
    assert body["status"] == "released"
    assert body["is_buyer"] is True
    assert EscrowTransaction.objects.get(account=account).status == "released"


def test_confirm_is_idempotent_for_buyer(client: Client):
    _, buyer, account, _ = _sold_listing()
    client.force_login(buyer)

    first = client.post(_confirm_url(account.pk)).json()
    second = client.post(_confirm_url(account.pk))

    assert second.status_code == HTTPStatus.OK
    assert second.json()["order_id"] == first["order_id"]
    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_seller_cannot_confirm(client: Client):
    seller, _, account, _ = _sold_listing()
    client.force_login(seller)

    response = client.post(_confirm_url(account.pk))

    assert response.status_code == HTTPStatus.FORBIDDEN
    assert EscrowTransaction.objects.get(account=account).status == "held"


def test_outsider_cannot_see_order(client: Client):
    _, _, account, _ = _sold_listing()
    client.force_login(UserFactory.create())

    assert client.get(_order_url(account.pk)).status_code == HTTPStatus.NOT_FOUND
    assert client.post(_confirm_url(account.pk)).status_code == HTTPStatus.NOT_FOUND


def test_confirm_without_payment_is_404(client: Client):
    seller = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon", price=PRICE)
    buyer = UserFactory.create()
    client.force_login(buyer)

    assert client.post(_confirm_url(account.pk)).status_code == HTTPStatus.NOT_FOUND


def test_seller_sees_held_status(client: Client):
    seller, _, account, _ = _sold_listing()
    client.force_login(seller)

    response = client.get(_order_url(account.pk))

    assert response.status_code == HTTPStatus.OK
    assert response.json()["status"] == "held"
    assert response.json()["is_seller"] is True
    assert response.json()["is_buyer"] is False


def test_release_service_guards():
    seller = UserFactory.create()
    buyer = UserFactory.create()
    outsider = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon", price=PRICE)

    with pytest.raises(OrderNotFoundError):
        release_escrow(account.pk, buyer)

    buy_account(account.pk, buyer)
    with pytest.raises(NotBuyerError):
        release_escrow(account.pk, seller)
    with pytest.raises(NotBuyerError):
        release_escrow(account.pk, outsider)

    order = release_escrow(account.pk, buyer)
    assert order.status == EscrowTransaction.RELEASED
    # Re-confirming stays idempotent.
    assert release_escrow(account.pk, buyer).status == EscrowTransaction.RELEASED

    order.status = EscrowTransaction.REFUNDED
    order.save(update_fields=["status", "updated_at"])
    with pytest.raises(OrderStateError):
        release_escrow(account.pk, buyer)
