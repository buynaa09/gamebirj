from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from backend.games.models import Game

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def test_list_games_as_anonymous_user(client: Client):
    game = Game.objects.create(name="Valorant")

    response = client.get(reverse("api:list_games"))

    assert response.status_code == HTTPStatus.OK
    assert {"id": game.pk, "name": "Valorant", "image": None} in response.json()


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
