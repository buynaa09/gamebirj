from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse

from backend.accounts.models import Account
from backend.accounts.models import RentalTransaction
from backend.accounts.services import _notify_owner_of_rental
from backend.chat.models import Conversation
from backend.chat.models import Message
from backend.games.models import Game
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PRICE = 100
DURATION = 3


def _rental_listing(price=PRICE, unit=Account.DAY):
    owner = UserFactory.create()
    account = Account.objects.create(
        user=owner,
        title="Rental dragon",
        price=price,
        kind=Account.RENT,
        rental_unit=unit,
    )
    return (owner, account)


def _rent_url(account_id: int) -> str:
    return reverse("api:rent_listing", kwargs={"account_id": account_id})


def test_rent_happy_path(client: Client):
    _, account = _rental_listing()
    renter = UserFactory.create()
    client.force_login(renter)

    response = client.post(
        _rent_url(account.pk),
        data={"duration": DURATION},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["account_id"] == account.pk
    assert body["duration"] == DURATION
    assert body["unit"] == Account.DAY
    assert body["total"] == PRICE * DURATION
    account.refresh_from_db()
    assert account.status == Account.RENTED
    rental = RentalTransaction.objects.get(account=account)
    assert rental.renter_id == renter.pk


def test_rent_notify_posts_alert_to_thread():
    owner, account = _rental_listing()
    renter = UserFactory.create()
    client_rental = RentalTransaction.objects.create(
        account=account,
        renter=renter,
        owner=owner,
        unit=Account.DAY,
        duration=2,
        unit_price=PRICE,
        total=PRICE * 2,
        start_at=account.created_at,
        end_at=account.created_at,
    )

    _notify_owner_of_rental(client_rental.pk)

    conversation = Conversation.objects.get(account=account)
    assert conversation.get_other_user_id(owner.pk) == renter.pk
    message = Message.objects.get(conversation=conversation)
    assert message.sender_id == renter.pk
    assert "Rental dragon" in message.content
    assert str(PRICE * 2) in message.content


@pytest.mark.django_db(transaction=True)
def test_rent_notifies_once_end_to_end(client: Client):
    _, account = _rental_listing()
    renter = UserFactory.create()
    client.force_login(renter)

    assert (
        client.post(
            _rent_url(account.pk),
            data={"duration": 2},
            content_type="application/json",
        ).status_code
        == HTTPStatus.OK
    )

    conversation = Conversation.objects.get(account=account)
    messages = Message.objects.filter(conversation=conversation)
    assert messages.count() == 1
    assert "Rental dragon" in messages[0].content


def test_rent_requires_login(client: Client):
    _, account = _rental_listing()

    response = client.post(
        _rent_url(account.pk),
        data={"duration": 1},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_rent_sale_listing_rejected(client: Client):
    seller = UserFactory.create()
    account = Account.objects.create(user=seller, title="Sale only", price=PRICE)
    renter = UserFactory.create()
    client.force_login(renter)

    response = client.post(
        _rent_url(account.pk),
        data={"duration": 1},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_rent_own_listing_rejected(client: Client):
    owner, account = _rental_listing()
    client.force_login(owner)

    response = client.post(
        _rent_url(account.pk),
        data={"duration": 1},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_rent_bad_duration_rejected(client: Client):
    _, account = _rental_listing()
    renter = UserFactory.create()
    client.force_login(renter)

    response = client.post(
        _rent_url(account.pk),
        data={"duration": 0},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_second_renter_gets_409(client: Client):
    _, account = _rental_listing()
    first = UserFactory.create()
    second = UserFactory.create()
    client.force_login(first)
    assert (
        client.post(
            _rent_url(account.pk),
            data={"duration": 2},
            content_type="application/json",
        ).status_code
        == HTTPStatus.OK
    )

    client.force_login(second)
    response = client.post(
        _rent_url(account.pk),
        data={"duration": 2},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.CONFLICT
    assert RentalTransaction.objects.filter(account=account).count() == 1


def test_rented_listing_hidden_from_marketplace(client: Client):
    _, account = _rental_listing()
    renter = UserFactory.create()
    client.force_login(renter)
    client.post(
        _rent_url(account.pk),
        data={"duration": 1},
        content_type="application/json",
    )

    client.force_login(UserFactory.create())
    body = client.get(reverse("api:list_accounts") + "?kind=rent").json()

    assert all(item["id"] != account.pk for item in body)


def test_create_rental_listing(client: Client):
    owner = UserFactory.create()
    game = Game.objects.create(name="Rent Test Game")
    client.force_login(owner)

    response = client.post(
        reverse("api:create_account"),
        {
            "game": str(game.pk),
            "title": "Rent me",
            "price": "50",
            "kind": "rent",
            "rental_unit": "hour",
            "details": "[]",
        },
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["kind"] == "rent"
    assert response.json()["rental_unit"] == "hour"
