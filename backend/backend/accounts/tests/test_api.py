from __future__ import annotations

import json
from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from backend.accounts.models import Account
from backend.games.models import Game
from backend.games.models import Listing
from backend.games.models import ListingChoice
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
    b"\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


def _image(name="shot.gif"):
    return SimpleUploadedFile(name, GIF, content_type="image/gif")


def _mlbb():
    return Game.objects.get(name="Mobile Legends")


def test_create_account_requires_login(client: Client):
    response = client.post(reverse("api:create_account"), data={})

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_create_account_happy_path(client: Client):
    user = UserFactory.create()
    client.force_login(user)
    game = _mlbb()
    # Seeded "Server" listing is game-agnostic (game=None), which the view
    # explicitly accepts alongside per-game listings.
    server = Listing.objects.get(game__isnull=True, title="Server")

    response = client.post(
        reverse("api:create_account"),
        data={
            "game": str(game.pk),
            "game_rank": "Mythic",
            "title": "",
            "price": "5500",
            "description": "Stacked account",
            "accept_offers": "true",
            "details": json.dumps([{"listing": server.pk, "value": "Asia"}]),
            "images": [_image()],
        },
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    payload = response.json()
    # Blank title falls back to the rank.
    assert payload["title"] == "Mythic"
    assert payload["game"] == "Mobile Legends"
    assert payload["game_rank"] == "Mythic"
    assert payload["price"] == 5500.0  # noqa: PLR2004
    assert payload["accept_offers"] is True
    assert len(payload["images"]) == 1

    account = Account.objects.get(pk=payload["id"])
    assert account.user == user
    assert account.listings.count() == 1
    item = account.listings.get()
    assert item.listing == server
    assert item.value == "Asia"
    assert account.images.count() == 1


def test_create_account_rejects_bad_price(client: Client):
    client.force_login(UserFactory.create())
    game = _mlbb()

    response = client.post(
        reverse("api:create_account"),
        data={"game": str(game.pk), "price": "0"},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert Account.objects.count() == 0


def test_create_account_rejects_foreign_rank(client: Client):
    client.force_login(UserFactory.create())
    game = _mlbb()

    response = client.post(
        reverse("api:create_account"),
        data={"game": str(game.pk), "price": "100", "game_rank": "Radiant"},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert Account.objects.count() == 0


def test_create_account_rejects_inactive_game(client: Client):
    client.force_login(UserFactory.create())
    game = Game.objects.create(name="Inactive Game", is_active_marketplace=False)

    response = client.post(
        reverse("api:create_account"),
        data={"game": str(game.pk), "price": "100"},
    )

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert Account.objects.count() == 0


def test_create_account_rejects_foreign_listing(client: Client):
    client.force_login(UserFactory.create())
    game = _mlbb()
    other = Game.objects.create(name="Other Game")
    foreign = Listing.objects.create(game=other, title="Other Field")

    response = client.post(
        reverse("api:create_account"),
        data={
            "game": str(game.pk),
            "price": "100",
            "details": json.dumps([{"listing": foreign.pk, "value": "x"}]),
        },
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert Account.objects.count() == 0


def test_create_account_choice_listing(client: Client):
    client.force_login(UserFactory.create())
    game = _mlbb()
    skin = Listing.objects.create(game=game, title="Skin", listing_type="choice")
    ListingChoice.objects.create(listing=skin, choice_value="Epic")

    ok = client.post(
        reverse("api:create_account"),
        data={
            "game": str(game.pk),
            "price": "100",
            "details": json.dumps([{"listing": skin.pk, "value": "Epic"}]),
        },
    )
    assert ok.status_code == HTTPStatus.OK, ok.json()
    item = Account.objects.get().listings.get()
    assert item.value == ""
    assert [c.choice_value for c in item.choices.all()] == ["Epic"]

    bad = client.post(
        reverse("api:create_account"),
        data={
            "game": str(game.pk),
            "price": "100",
            "details": json.dumps([{"listing": skin.pk, "value": "Common"}]),
        },
    )
    assert bad.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_account_rejects_non_image(client: Client):
    client.force_login(UserFactory.create())
    game = _mlbb()
    text = SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")

    response = client.post(
        reverse("api:create_account"),
        data={"game": str(game.pk), "price": "100", "images": [text]},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert Account.objects.count() == 0


def test_retrieve_account_is_public(client: Client):
    user = UserFactory.create()
    game = _mlbb()
    account = Account.objects.create(user=user, title="Detail", game=game, price=99)

    response = client.get(
        reverse("api:retrieve_account", kwargs={"account_id": account.pk})
    )

    assert response.status_code == HTTPStatus.OK
    payload = response.json()
    assert payload["title"] == "Detail"
    assert payload["seller"] == user.username


def test_retrieve_account_missing(client: Client):
    response = client.get(
        reverse("api:retrieve_account", kwargs={"account_id": 999999})
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_list_my_accounts_only_own(client: Client):
    me = UserFactory.create()
    other_user = UserFactory.create()
    game = _mlbb()
    Account.objects.create(user=me, title="Mine", game=game, price=10)
    Account.objects.create(user=other_user, title="Theirs", game=game, price=20)
    client.force_login(me)

    response = client.get(reverse("api:list_my_accounts"))

    assert response.status_code == HTTPStatus.OK
    assert [a["title"] for a in response.json()] == ["Mine"]


def test_list_accounts_is_public_and_newest_first(client: Client):
    user = UserFactory.create()
    game = _mlbb()
    other = Game.objects.create(name="Other Game")
    Account.objects.create(user=user, title="Old", game=game, price=10)
    Account.objects.create(user=user, title="New", game=other, price=20)

    response = client.get(reverse("api:list_accounts"))

    assert response.status_code == HTTPStatus.OK
    payload = response.json()
    assert [a["title"] for a in payload] == ["New", "Old"]
    assert payload[0]["seller"] == user.username
    assert payload[0]["created_at"] != ""


def test_list_accounts_filter_by_game(client: Client):
    user = UserFactory.create()
    game = _mlbb()
    other = Game.objects.create(name="Other Game")
    Account.objects.create(user=user, title="Mlbb", game=game, price=10)
    Account.objects.create(user=user, title="Other", game=other, price=20)

    response = client.get(reverse("api:list_accounts"), {"game": str(game.pk)})

    assert response.status_code == HTTPStatus.OK
    assert [a["title"] for a in response.json()] == ["Mlbb"]


def test_list_accounts_search(client: Client):
    user = UserFactory.create()
    game = _mlbb()
    Account.objects.create(user=user, title="Mythic stacked", game=game, price=10)
    Account.objects.create(user=user, title="Starter", game=game, price=20)

    response = client.get(reverse("api:list_accounts"), {"q": "mythic"})

    assert response.status_code == HTTPStatus.OK
    assert [a["title"] for a in response.json()] == ["Mythic stacked"]


def test_wishlist_add_list_remove(client: Client):
    user = UserFactory.create()
    game = _mlbb()
    account = Account.objects.create(user=user, title="Wanted", game=game, price=10)
    client.force_login(user)

    add = client.post(reverse("api:add_wishlist", kwargs={"account_id": account.pk}))
    assert add.status_code == HTTPStatus.OK
    assert add.json() == {"wishlisted": True}

    # Idempotent re-add.
    again = client.post(reverse("api:add_wishlist", kwargs={"account_id": account.pk}))
    assert again.status_code == HTTPStatus.OK
    assert user.wishlist.count() == 1

    listed = client.get(reverse("api:list_wishlist"))
    assert listed.status_code == HTTPStatus.OK
    assert [a["id"] for a in listed.json()] == [account.pk]

    detail = client.get(reverse("api:list_accounts"))
    payload = next(a for a in detail.json() if a["id"] == account.pk)
    assert payload["wishlisted"] is True
    assert payload["wishlist_count"] == 1

    remove = client.delete(reverse("api:remove_wishlist", kwargs={"account_id": account.pk}))
    assert remove.status_code == HTTPStatus.OK
    assert remove.json() == {"wishlisted": False}
    assert user.wishlist.count() == 0


def test_wishlist_requires_login(client: Client):
    game = _mlbb()
    account = Account.objects.create(
        user=UserFactory.create(), title="Wanted", game=game, price=10
    )

    assert (
        client.post(reverse("api:add_wishlist", kwargs={"account_id": account.pk})).status_code
        == HTTPStatus.UNAUTHORIZED
    )
    assert (
        client.delete(
            reverse("api:remove_wishlist", kwargs={"account_id": account.pk})
        ).status_code
        == HTTPStatus.UNAUTHORIZED
    )
    assert client.get(reverse("api:list_wishlist")).status_code == HTTPStatus.UNAUTHORIZED


def test_wishlist_missing_listing(client: Client):
    client.force_login(UserFactory.create())

    response = client.post(reverse("api:add_wishlist", kwargs={"account_id": 999999}))

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_update_own_account(client: Client):
    user = UserFactory.create()
    client.force_login(user)
    game = _mlbb()
    account = Account.objects.create(user=user, title="Old", game=game, price=10)

    response = client.patch(
        reverse("api:update_account", kwargs={"account_id": account.pk}),
        data={"title": "New", "price": "777", "accept_offers": False},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    account.refresh_from_db()
    assert account.title == "New"
    assert float(account.price) == 777.0
    assert account.accept_offers is False


def test_update_account_rejects_bad_price(client: Client):
    user = UserFactory.create()
    client.force_login(user)
    account = Account.objects.create(user=user, title="Old", game=_mlbb(), price=10)

    response = client.patch(
        reverse("api:update_account", kwargs={"account_id": account.pk}),
        data={"price": "-5"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_update_other_users_account_not_found(client: Client):
    owner = UserFactory.create()
    client.force_login(UserFactory.create())
    account = Account.objects.create(user=owner, title="Theirs", game=_mlbb(), price=10)

    response = client.patch(
        reverse("api:update_account", kwargs={"account_id": account.pk}),
        data={"title": "Hijacked"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_delete_own_account(client: Client):
    user = UserFactory.create()
    client.force_login(user)
    account = Account.objects.create(user=user, title="Mine", game=_mlbb(), price=10)

    response = client.delete(reverse("api:delete_account", kwargs={"account_id": account.pk}))

    assert response.status_code == HTTPStatus.OK
    assert Account.objects.filter(pk=account.pk).count() == 0


def test_delete_other_users_account_not_found(client: Client):
    owner = UserFactory.create()
    client.force_login(UserFactory.create())
    account = Account.objects.create(user=owner, title="Theirs", game=_mlbb(), price=10)

    response = client.delete(reverse("api:delete_account", kwargs={"account_id": account.pk}))

    assert response.status_code == HTTPStatus.NOT_FOUND
    assert Account.objects.filter(pk=account.pk).count() == 1
