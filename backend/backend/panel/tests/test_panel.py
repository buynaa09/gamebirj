from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.accounts.services import buy_account
from backend.chat import services as chat_services
from backend.games.models import Game
from backend.games.models import GameRank
from backend.games.models import Listing
from backend.games.models import ListingChoice
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def _staff():
    return UserFactory.create(is_staff=True)


def test_dashboard_requires_login(client: Client):
    response = client.get(reverse("panel:dashboard"))

    assert response.status_code == HTTPStatus.FOUND
    assert "login" in response["Location"]


def test_dashboard_forbidden_for_non_staff(client: Client):
    client.force_login(UserFactory.create())

    response = client.get(reverse("panel:dashboard"))

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_dashboard_ok_for_staff(client: Client):
    seller = UserFactory.create()
    Account.objects.create(user=seller, title="Dragon", price=100)
    client.force_login(_staff())

    response = client.get(reverse("panel:dashboard"))

    assert response.status_code == HTTPStatus.OK
    assert "Dragon" in response.content.decode()


def test_user_toggle_active(client: Client):
    target = UserFactory.create()
    client.force_login(_staff())

    response = client.post(reverse("panel:user_toggle_active", args=[target.username]))

    assert response.status_code == HTTPStatus.FOUND
    target.refresh_from_db()
    assert target.is_active is False


def test_user_cannot_deactivate_self(client: Client):
    staff = _staff()
    client.force_login(staff)

    response = client.post(reverse("panel:user_toggle_active", args=[staff.username]))

    assert response.status_code == HTTPStatus.FOUND
    staff.refresh_from_db()
    assert staff.is_active is True


def test_user_toggle_staff(client: Client):
    target = UserFactory.create()
    client.force_login(_staff())

    response = client.post(reverse("panel:user_toggle_staff", args=[target.username]))

    assert response.status_code == HTTPStatus.FOUND
    target.refresh_from_db()
    assert target.is_staff is True


def test_account_list_filters_by_kind(client: Client):
    seller = UserFactory.create()
    Account.objects.create(user=seller, title="Sale one", price=10)
    Account.objects.create(
        user=seller,
        title="Rent one",
        price=5,
        kind=Account.RENT,
        rental_unit=Account.DAY,
    )
    client.force_login(_staff())

    response = client.get(reverse("panel:account_list") + "?kind=rent")

    body = response.content.decode()
    assert response.status_code == HTTPStatus.OK
    assert "Rent one" in body
    assert "Sale one" not in body


def test_account_delete(client: Client):
    seller = UserFactory.create()
    account = Account.objects.create(user=seller, title="Gone", price=10)
    client.force_login(_staff())

    response = client.post(reverse("panel:account_delete", args=[account.pk]))

    assert response.status_code == HTTPStatus.FOUND
    assert not Account.objects.filter(pk=account.pk).exists()


def test_account_toggle_offers(client: Client):
    seller = UserFactory.create()
    account = Account.objects.create(user=seller, title="Offers", price=10)
    client.force_login(_staff())

    response = client.post(reverse("panel:account_toggle_offers", args=[account.pk]))

    assert response.status_code == HTTPStatus.FOUND
    account.refresh_from_db()
    assert account.accept_offers is False


def test_game_create_and_rank_flow(client: Client):
    client.force_login(_staff())

    response = client.post(
        reverse("panel:game_add"),
        {"name": "Panel Game", "image": ""},
    )

    assert response.status_code == HTTPStatus.FOUND
    game = Game.objects.get(name="Panel Game")

    response = client.post(
        reverse("panel:rank_add", args=[game.pk]),
        {"name": "Gold", "order": 1},
    )

    assert response.status_code == HTTPStatus.FOUND
    rank = GameRank.objects.get(game=game, name="Gold")

    response = client.post(
        reverse("panel:rank_delete", args=[game.pk, rank.pk]),
    )

    assert response.status_code == HTTPStatus.FOUND
    assert not GameRank.objects.filter(pk=rank.pk).exists()


def test_listing_and_choice_flow(client: Client):
    game = Game.objects.create(name="Choice Game")
    client.force_login(_staff())

    response = client.post(
        reverse("panel:listing_add"),
        {
            "game": str(game.pk),
            "title": "Server",
            "listing_type": "choice",
            "place_holder_value": "",
        },
    )

    assert response.status_code == HTTPStatus.FOUND
    listing = Listing.objects.get(title="Server", game=game)

    response = client.post(
        reverse("panel:choice_add", args=[listing.pk]),
        {"choice_value": "Asia"},
    )

    assert response.status_code == HTTPStatus.FOUND
    choice = ListingChoice.objects.get(listing=listing, choice_value="Asia")

    response = client.post(
        reverse("panel:choice_delete", args=[listing.pk, choice.pk]),
    )

    assert response.status_code == HTTPStatus.FOUND
    assert not ListingChoice.objects.filter(pk=choice.pk).exists()


def test_conversation_detail_read_only(client: Client):
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Chat acct", price=50)
    conversation, _ = chat_services.get_or_create_private_conversation(
        buyer,
        seller,
        account=account,
    )
    chat_services.send_message(conversation, buyer, "Hi seller")
    client.force_login(_staff())

    response = client.get(reverse("panel:conversation_detail", args=[conversation.pk]))

    assert response.status_code == HTTPStatus.OK
    assert "Hi seller" in response.content.decode()


def test_transaction_list_shows_escrow(client: Client):
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Escrow acct", price=77)
    buy_account(account.pk, buyer)
    client.force_login(_staff())

    response = client.get(reverse("panel:transaction_list"))

    assert response.status_code == HTTPStatus.OK
    assert "Escrow acct" in response.content.decode()
    assert EscrowTransaction.objects.filter(account=account).exists()
