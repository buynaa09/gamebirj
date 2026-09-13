from __future__ import annotations

import threading
from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse
from django.utils import timezone

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.accounts.services import AlreadySoldError
from backend.accounts.services import buy_account
from backend.chat import services as chat_services
from backend.chat.models import Offer
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PRICE = 100
OFFER_PRICE = 60


def _listing(price=PRICE):
    seller = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon account", price=price)
    return (seller, account)


def _buy_url(account_id: int) -> str:
    return reverse("api:buy_listing", kwargs={"account_id": account_id})


def test_buy_happy_path(client: Client):
    _, account = _listing()
    buyer = UserFactory.create()
    client.force_login(buyer)

    response = client.post(_buy_url(account.pk))

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["account_id"] == account.pk
    assert body["amount"] == PRICE
    assert body["status"] == "held"
    account.refresh_from_db()
    assert account.status == Account.SOLD
    assert account.buyer_id == buyer.pk
    assert account.sold_price == PRICE
    assert account.sold_at is not None
    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_buy_requires_login(client: Client):
    _, account = _listing()

    response = client.post(_buy_url(account.pk))

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_buy_unknown_listing(client: Client):
    buyer = UserFactory.create()
    client.force_login(buyer)

    response = client.post(_buy_url(999999))

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_buy_own_listing_rejected(client: Client):
    seller, account = _listing()
    client.force_login(seller)

    response = client.post(_buy_url(account.pk))

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_second_buyer_gets_409(client: Client):
    _, account = _listing()
    first = UserFactory.create()
    second = UserFactory.create()
    client.force_login(first)
    assert client.post(_buy_url(account.pk)).status_code == HTTPStatus.OK

    client.force_login(second)
    response = client.post(_buy_url(account.pk))

    assert response.status_code == HTTPStatus.CONFLICT
    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_winner_retry_is_idempotent(client: Client):
    _, account = _listing()
    buyer = UserFactory.create()
    client.force_login(buyer)

    first = client.post(_buy_url(account.pk)).json()
    second = client.post(_buy_url(account.pk))

    assert second.status_code == HTTPStatus.OK
    assert second.json()["order_id"] == first["order_id"]
    assert EscrowTransaction.objects.filter(account=account).count() == 1


def test_sold_listing_visible_with_status(client: Client):
    _, account = _listing()
    buyer = UserFactory.create()
    client.force_login(buyer)
    client.post(_buy_url(account.pk))

    detail = client.get(
        reverse("api:retrieve_account", kwargs={"account_id": account.pk}),
    )

    assert detail.status_code == HTTPStatus.OK
    assert detail.json()["status"] == "sold"
    # The buyer sees what they paid; strangers do not.
    assert detail.json()["sold_price"] == PRICE

    stranger = UserFactory.create()
    client.force_login(stranger)
    hidden = client.get(
        reverse("api:retrieve_account", kwargs={"account_id": account.pk}),
    ).json()
    assert hidden["status"] == "sold"
    assert hidden["sold_price"] is None


def test_buy_honors_accepted_offer():
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon", price=PRICE)
    conversation, _ = chat_services.get_or_create_private_conversation(
        buyer,
        seller,
        account=account,
    )
    offer = chat_services.create_offer(conversation, buyer, OFFER_PRICE)
    chat_services.decide_offer(offer, seller, "accept")

    order = buy_account(account.pk, buyer)

    assert order.amount == OFFER_PRICE
    account.refresh_from_db()
    assert account.sold_price == OFFER_PRICE


def test_buy_ignores_expired_hold():
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon", price=PRICE)
    conversation, _ = chat_services.get_or_create_private_conversation(
        buyer,
        seller,
        account=account,
    )
    offer = chat_services.create_offer(conversation, buyer, OFFER_PRICE)
    chat_services.decide_offer(offer, seller, "accept")
    EscrowTransaction.objects.all().delete()
    Offer.objects.filter(pk=offer.pk).update(
        decided_at=timezone.now() - timezone.timedelta(hours=25),
    )

    order = buy_account(account.pk, buyer)

    assert order.amount == PRICE


@pytest.mark.django_db(transaction=True)
def test_concurrent_buy_single_winner():
    seller = UserFactory.create()
    buyers = [UserFactory.create() for _ in range(3)]
    account = Account.objects.create(user=seller, title="Dragon", price=PRICE)
    barrier = threading.Barrier(len(buyers))
    results: dict[int, str] = {}

    def attempt(buyer) -> None:
        barrier.wait(timeout=10)
        try:
            buy_account(account.pk, buyer)
        except AlreadySoldError:
            results[buyer.pk] = "sold"
        else:
            results[buyer.pk] = "won"

    threads = [threading.Thread(target=attempt, args=(buyer,)) for buyer in buyers]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    assert sorted(results.values()) == ["sold", "sold", "won"]
    account.refresh_from_db()
    assert account.status == Account.SOLD
    assert EscrowTransaction.objects.filter(account=account).count() == 1
