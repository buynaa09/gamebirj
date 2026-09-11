from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from backend.games.models import Game
from backend.games.models import GameRank
from backend.games.models import Listing
from backend.games.models import ListingChoice

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def test_list_games_as_anonymous_user(client: Client):
    game = Game.objects.create(name="Valorant")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    payload = next(g for g in response.json() if g["id"] == game.pk)
    assert payload["name"] == "Valorant"
    assert payload["image"] is None
    assert payload["ranks"] == []
    # Only seeded global listings apply to a fresh game.
    titles = {item["title"] for item in payload["listings"]}
    assert titles >= {"Server", "Account Level"}


def test_list_games_ordered_by_name(client: Client):
    Game.objects.create(name="b-side game")
    Game.objects.create(name="A-side game")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    names = [g["name"] for g in response.json()]
    assert names.index("A-side game") < names.index("b-side game")


def test_list_games_returns_absolute_image_url(client: Client):
    gif = (
        b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
        b"\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
        b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
    )
    game = Game.objects.create(
        name="Pixel Quest",
        image=SimpleUploadedFile("pixel.gif", gif, content_type="image/gif"),
    )

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    payload = next(g for g in response.json() if g["id"] == game.pk)
    assert payload["image"] == f"http://media.testserver/{game.image.name}"


def test_list_games_includes_ranks_and_listings(client: Client):
    game = Game.objects.create(name="Catalog Game")
    GameRank.objects.create(game=game, order=2, name="Gold")
    GameRank.objects.create(game=game, order=1, name="Silver")
    Listing.objects.create(
        game=game, title="Server", place_holder_value="Server / region",
    )
    Listing.objects.create(game=game, title="Rank / Level")
    skin = Listing.objects.create(
        game=game,
        title="Skin",
        listing_type="choice",
        place_holder_value="Pick a skin",
    )
    ListingChoice.objects.create(listing=skin, choice_value="Epic")
    ListingChoice.objects.create(listing=skin, choice_value="Legend")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    payload = next(g for g in response.json() if g["id"] == game.pk)
    assert payload["ranks"] == ["Silver", "Gold"]
    titles = [item["title"] for item in payload["listings"]]
    assert "Rank / Level" not in titles
    by_title = {item["title"]: item for item in payload["listings"]}
    assert by_title["Server"]["listing_type"] == "text"
    assert by_title["Server"]["place_holder_value"] == "Server / region"
    assert by_title["Server"]["choices"] == []
    assert by_title["Skin"]["listing_type"] == "choice"
    assert by_title["Skin"]["choices"] == ["Epic", "Legend"]


def test_list_games_includes_global_listings(client: Client):
    game = Game.objects.create(name="Global Game")
    Listing.objects.create(title="Global Field", place_holder_value="Anything")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    payload = next(g for g in response.json() if g["id"] == game.pk)
    assert "Global Field" in [item["title"] for item in payload["listings"]]


def test_game_specific_listing_shadows_global(client: Client):
    game = Game.objects.create(name="Shadow Game")
    Listing.objects.create(title="Server", place_holder_value="Global server")
    Listing.objects.create(game=game, title="Server", place_holder_value="Game server")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    payload = next(g for g in response.json() if g["id"] == game.pk)
    servers = [item for item in payload["listings"] if item["title"] == "Server"]
    assert len(servers) == 1
    assert servers[0]["place_holder_value"] == "Game server"
