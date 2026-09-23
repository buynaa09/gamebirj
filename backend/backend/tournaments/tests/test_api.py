from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse
from django.utils import timezone

from backend.games.models import Game
from backend.tournaments.api import views as tournament_views
from backend.tournaments.id_check import IdCheckAccount
from backend.tournaments.id_check import IdCheckNotFoundError
from backend.tournaments.models import Tournament
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def make_tournament(title="MLBB Cup", game_name="Mobile Legends", **kwargs):
    game = Game.objects.create(name=game_name)
    defaults = {
        "title": title,
        "status": Tournament.Status.OPEN,
        "prize_pool": "1,000,000₮",
        "entry_fee": "Үнэгүй",
        "starts_at": timezone.now(),
        "format": "5v5 · Single Elimination",
        "total_slots": 32,
        "filled_slots": 21,
        "slot_unit": "баг",  # noqa: RUF001 — Mongolian word for "team"
    }
    return Tournament.objects.create(game=game, **{**defaults, **kwargs})


def test_list_tournaments_as_anonymous_user(client: Client):
    tournament = make_tournament()

    response = client.get(reverse("api:list_tournaments"))

    assert response.status_code == HTTPStatus.OK
    payload = next(t for t in response.json() if t["id"] == tournament.pk)
    assert payload["title"] == "MLBB Cup"
    assert payload["game"] == "Mobile Legends"
    assert payload["game_id"] == tournament.game_id
    assert payload["status"] == "open"
    assert payload["prize_pool"] == "1,000,000₮"
    assert payload["entry_fee"] == tournament.entry_fee
    assert payload["starts_at"] == tournament.starts_at.isoformat()
    assert payload["ends_at"] is None
    assert payload["mode"] == "Online"
    assert payload["team_size"] == tournament.team_size
    assert payload["rules"] == ""
    assert payload["format"] == "5v5 · Single Elimination"
    assert payload["total_slots"] == tournament.total_slots
    assert payload["filled_slots"] == tournament.filled_slots
    assert payload["slot_unit"] == "баг"  # noqa: RUF001 — Mongolian word for "team"


def test_list_tournaments_excludes_inactive(client: Client):
    active = make_tournament(title="Active Cup")
    inactive = make_tournament(title="Hidden Cup", is_active=False)

    response = client.get(reverse("api:list_tournaments"))

    assert response.status_code == HTTPStatus.OK
    ids = {t["id"] for t in response.json()}
    assert active.pk in ids
    assert inactive.pk not in ids


def test_list_tournaments_excludes_tournament_inactive_game(client: Client):
    visible = make_tournament(title="Visible Cup")
    game = Game.objects.create(
        name="Tournament Inactive Game",
        is_active_marketplace=True,
        is_active_tournament=False,
    )
    hidden = Tournament.objects.create(
        game=game,
        title="Hidden Cup",
        status=Tournament.Status.OPEN,
        prize_pool="100,000₮",
    )

    response = client.get(reverse("api:list_tournaments"))

    assert response.status_code == HTTPStatus.OK
    ids = {t["id"] for t in response.json()}
    assert visible.pk in ids
    assert hidden.pk not in ids


def test_list_tournaments_null_starts_at(client: Client):
    tournament = make_tournament(title="Live Clash", status=Tournament.Status.LIVE)
    tournament.starts_at = None
    tournament.save()

    response = client.get(reverse("api:list_tournaments"))

    assert response.status_code == HTTPStatus.OK
    payload = next(t for t in response.json() if t["id"] == tournament.pk)
    assert payload["starts_at"] is None
    assert payload["status"] == "live"


def test_register_team_happy_path(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_tournament(title="Open Cup", filled_slots=21)
    filled_before = tournament.filled_slots

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "512345678"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK
    payload = response.json()
    assert payload["team_name"] == "Night Wolves"
    assert payload["leader_game_id"] == "512345678"
    assert payload["tournament"] == tournament.pk
    tournament.refresh_from_db()
    assert tournament.filled_slots == filled_before + 1


def test_register_team_requires_auth(client: Client):
    tournament = make_tournament(title="Open Cup")

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "512345678"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_register_team_rejects_blank_fields(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_tournament(title="Open Cup")

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "  ", "leader_game_id": ""},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_register_team_rejects_closed_tournament(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_tournament(title="Live Cup", status=Tournament.Status.LIVE)

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "512345678"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_register_team_rejects_duplicate_team(client: Client):
    user = UserFactory.create()
    client.force_login(user)
    tournament = make_tournament(title="Open Cup")

    first = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "512345678"},
        content_type="application/json",
    )
    assert first.status_code == HTTPStatus.OK

    second = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "999999999"},
        content_type="application/json",
    )

    assert second.status_code == HTTPStatus.CONFLICT


def test_register_team_rejects_full_tournament(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_tournament(title="Full Cup", total_slots=16, filled_slots=16)

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "512345678"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def make_checkable_tournament(title="MLBB Cup"):
    tournament = make_tournament(title=title)
    tournament.game.id_check_slug = "mobile-legends"
    tournament.game.save(update_fields=["id_check_slug"])
    return tournament


def test_check_id_returns_nickname(client: Client, monkeypatch):
    client.force_login(UserFactory.create())
    tournament = make_checkable_tournament()
    monkeypatch.setattr(
        tournament_views,
        "check_game_account",
        lambda slug, user_id, server_id="": IdCheckAccount(
            nickname="NightWolf", region="Mongolia",
        ),
    )

    response = client.post(
        reverse("api:check_leader_id"),
        data={
            "tournament_id": tournament.pk,
            "user_id": "1234449725",
            "server_id": "11467",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK
    assert response.json() == {"nickname": "NightWolf", "region": "Mongolia"}


def test_check_id_rejects_unknown_account(client: Client, monkeypatch):
    client.force_login(UserFactory.create())
    tournament = make_checkable_tournament()

    def _missing(slug, user_id, server_id=""):
        raise IdCheckNotFoundError

    monkeypatch.setattr(tournament_views, "check_game_account", _missing)

    response = client.post(
        reverse("api:check_leader_id"),
        data={"tournament_id": tournament.pk, "user_id": "1", "server_id": "1"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_check_id_unsupported_game(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_tournament(title="Open Cup")

    response = client.post(
        reverse("api:check_leader_id"),
        data={"tournament_id": tournament.pk, "user_id": "1", "server_id": "1"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.BAD_REQUEST


def test_register_team_verifies_leader_and_stores_nickname(client: Client, monkeypatch):
    client.force_login(UserFactory.create())
    tournament = make_checkable_tournament()
    monkeypatch.setattr(
        tournament_views,
        "check_game_account",
        lambda slug, user_id, server_id="": IdCheckAccount(
            nickname="NightWolf", region="Mongolia",
        ),
    )

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={
            "team_name": "Night Wolves",
            "leader_game_id": "1234449725",
            "leader_server_id": "11467",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK
    payload = response.json()
    assert payload["leader_server_id"] == "11467"
    assert payload["leader_nickname"] == "NightWolf"


def test_register_team_requires_server_id_for_checkable_game(client: Client):
    client.force_login(UserFactory.create())
    tournament = make_checkable_tournament()

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={"team_name": "Night Wolves", "leader_game_id": "1234449725"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_register_team_rejects_invalid_leader(client: Client, monkeypatch):
    client.force_login(UserFactory.create())
    tournament = make_checkable_tournament()

    def _missing(slug, user_id, server_id=""):
        raise IdCheckNotFoundError

    monkeypatch.setattr(tournament_views, "check_game_account", _missing)

    response = client.post(
        reverse("api:register_team", kwargs={"tournament_id": tournament.pk}),
        data={
            "team_name": "Night Wolves",
            "leader_game_id": "1",
            "leader_server_id": "1",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_retrieve_tournament_detail(client: Client):
    tournament = make_checkable_tournament(title="Detail Cup")
    other = UserFactory.create()
    registration_model = tournament.registrations.model
    registration_model.objects.create(
        tournament=tournament,
        user=other,
        team_name="Night Wolves",
        leader_game_id="1234449725",
        leader_server_id="11467",
        leader_nickname="NightWolf",
    )

    url = reverse("api:retrieve_tournament", kwargs={"tournament_id": tournament.pk})
    response = client.get(url)

    assert response.status_code == HTTPStatus.OK
    payload = response.json()
    assert payload["title"] == "Detail Cup"
    assert payload["id_check_slug"] == "mobile-legends"
    assert len(payload["registrations"]) == 1
    team = payload["registrations"][0]
    assert team["team_name"] == "Night Wolves"
    assert team["leader_nickname"] == "NightWolf"
    # Leader game IDs are never exposed publicly.
    assert "leader_game_id" not in team
    assert "leader_server_id" not in team


def test_retrieve_tournament_detail_404_for_inactive_game(client: Client):
    tournament = make_tournament(title="Hidden Cup")
    tournament.game.is_active_tournament = False
    tournament.game.save(update_fields=["is_active_tournament"])

    url = reverse("api:retrieve_tournament", kwargs={"tournament_id": tournament.pk})
    response = client.get(url)

    assert response.status_code == HTTPStatus.NOT_FOUND
