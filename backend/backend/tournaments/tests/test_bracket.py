from __future__ import annotations

from datetime import timedelta
from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse
from django.utils import timezone

from backend.games.models import Game
from backend.tournaments import bracket as bracket_mod
from backend.tournaments.bracket import advance_winners
from backend.tournaments.bracket import bracket_size
from backend.tournaments.bracket import ensure_bracket
from backend.tournaments.bracket import ensure_rooms
from backend.tournaments.bracket import round_count
from backend.tournaments.match_tools import MatchLobby
from backend.tournaments.match_tools import MatchRoom
from backend.tournaments.models import MLBBMatchConfig
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentMatch
from backend.tournaments.models import TournamentRegistration
from backend.tournaments.models import TournamentTeam
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def make_tournament(title="Bracket Cup", total_slots=8, **kwargs):
    game = Game.objects.create(name=f"Game {title}")
    defaults = {
        "title": title,
        "status": Tournament.Status.OPEN,
        "prize_pool": "100,000",
        "entry_fee": "10,000",
        "starts_at": timezone.now(),
        "format": "5v5 · Single Elimination",
        "total_slots": total_slots,
        "filled_slots": 0,
        "slot_unit": "bag",
    }
    return Tournament.objects.create(game=game, **{**defaults, **kwargs})


def make_registration(tournament, team_name, user=None):
    user = user or UserFactory.create()
    team = TournamentTeam.objects.create(
        game=tournament.game,
        owner=user,
        name=team_name,
        leader_game_id="1",
    )
    return TournamentRegistration.objects.create(
        tournament=tournament,
        user=user,
        team=team,
    )


def test_bracket_size_rounds():
    size = 8
    rounds = 3
    assert bracket_size(size) == size
    assert bracket_size(size - 2) == size
    assert bracket_size(rounds - 1) == rounds - 1
    assert round_count(size) == rounds


def test_ensure_bracket_creates_all_rounds_and_seats_teams(monkeypatch):
    monkeypatch.setattr(
        "backend.tournaments.bracket.random.shuffle",
        lambda teams: None,
    )
    tournament = make_tournament(total_slots=8)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")

    matches = ensure_bracket(tournament)

    assert len(matches) == 4 + 2 + 1
    first = [m for m in matches if m.round_index == 0]
    assert [m.team_a.name for m in first] == ["Team A", "Team C"]
    assert [m.team_b.name for m in first] == ["Team B", "Team D"]
    # Idempotent.
    assert len(ensure_bracket(tournament)) == 4 + 2 + 1


def test_late_registration_fills_empty_seat():
    tournament = make_tournament(total_slots=8)
    make_registration(tournament, "Team A")
    ensure_bracket(tournament)
    make_registration(tournament, "Team B")

    ensure_bracket(tournament)

    first = tournament.matches.get(round_index=0, position=0)
    assert first.team_a.name == "Team A"
    assert first.team_b.name == "Team B"


def test_advance_winners_propagates():
    tournament = make_tournament(total_slots=4)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")
    ensure_bracket(tournament)
    semifinal = tournament.matches.get(round_index=0, position=0)
    semifinal.winner = semifinal.team_a
    semifinal.save(update_fields=["winner"])

    advance_winners(tournament)

    final = tournament.matches.get(round_index=1, position=0)
    assert final.team_a == semifinal.team_a


def test_winner_marks_match_finished():
    tournament = make_tournament(total_slots=4)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")
    ensure_bracket(tournament)
    semifinal = tournament.matches.get(round_index=0, position=0)
    semifinal.winner = semifinal.team_a
    semifinal.score_a = 2
    semifinal.score_b = 0
    semifinal.save()

    advance_winners(tournament)

    semifinal.refresh_from_db()
    assert semifinal.status == TournamentMatch.Status.FINISHED


def test_ensure_rooms_creates_lobbies_once(monkeypatch):
    tournament = make_tournament(total_slots=4)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")
    ensure_bracket(tournament)
    MLBBMatchConfig.objects.create(cookie="test-cookie")
    calls: list[str] = []

    def _fake_create(name: str, cookie: str) -> MatchRoom:
        calls.append(name)
        return MatchRoom("mid", name, "create")

    monkeypatch.setattr(bracket_mod, "create_lobby", _fake_create)
    monkeypatch.setattr(
        bracket_mod,
        "get_lobby_url",
        lambda match_id, cookie: MatchLobby(
            url="https://s.mobilelegends.com/x",
            name="",
            status="create",
            is_closed=False,
        ),
    )

    created, errors = ensure_rooms(tournament)

    expected_rooms = 2
    assert created == expected_rooms
    assert errors == []
    assert TournamentMatch.objects.filter(status="open").count() == expected_rooms
    # Second run creates nothing (idempotent).
    assert ensure_rooms(tournament) == (0, [])


def test_ensure_rooms_deadline_never_lands_in_the_past(monkeypatch):
    """A round-0 room opened after kick-off must not start out expired."""
    tournament = make_tournament(
        total_slots=2,
        starts_at=timezone.now() - timedelta(hours=1),
    )
    make_registration(tournament, "Team A")
    make_registration(tournament, "Team B")
    ensure_bracket(tournament)
    MLBBMatchConfig.objects.create(cookie="test-cookie")
    monkeypatch.setattr(
        bracket_mod,
        "create_lobby",
        lambda name, cookie: MatchRoom("mid", name, "create"),
    )
    monkeypatch.setattr(
        bracket_mod,
        "get_lobby_url",
        lambda match_id, cookie: MatchLobby(
            url="https://s.mobilelegends.com/x",
            name="",
            status="create",
            is_closed=False,
        ),
    )

    created, errors = ensure_rooms(tournament)

    assert created == 1
    assert errors == []
    match = tournament.matches.get()
    assert match.lobby_deadline is not None
    assert timezone.now() < match.lobby_deadline <= timezone.now() + timedelta(minutes=5)


def test_ensure_rooms_without_cookie_reports_error():
    tournament = make_tournament(total_slots=2)
    make_registration(tournament, "Team A")
    make_registration(tournament, "Team B")
    ensure_bracket(tournament)

    created, errors = ensure_rooms(tournament)

    assert created == 0
    assert errors


def test_list_matches_gates_draft_url(client: Client, monkeypatch):
    owner = UserFactory.create()
    stranger = UserFactory.create()
    tournament = make_tournament(total_slots=2)
    make_registration(tournament, "Team A", user=owner)
    make_registration(tournament, "Team B")
    ensure_bracket(tournament)
    match = tournament.matches.get()
    match.mlbb_match_id = "mid"
    match.draft_url = "https://s.mobilelegends.com/x"
    match.status = TournamentMatch.Status.OPEN
    match.save()
    monkeypatch.setattr(bracket_mod, "ensure_rooms", lambda t: (0, []))

    url = reverse("api:list_matches", kwargs={"tournament_id": tournament.pk})
    client.force_login(owner)
    mine = client.get(url).json()
    client.force_login(stranger)
    theirs = client.get(url).json()

    assert mine[0]["draft_url"] == "https://s.mobilelegends.com/x"
    assert theirs[0]["draft_url"] is None
    assert theirs[0]["has_room"] is True


def test_ensure_endpoint_requires_staff(client: Client):
    tournament = make_tournament()
    client.force_login(UserFactory.create())

    url = reverse("api:ensure_match_rooms", kwargs={"tournament_id": tournament.pk})
    response = client.post(url)

    assert response.status_code == HTTPStatus.FORBIDDEN


def test_seven_teams_get_one_first_round_bye(monkeypatch):
    monkeypatch.setattr(
        "backend.tournaments.bracket.random.shuffle",
        lambda teams: None,
    )
    tournament = make_tournament(total_slots=8)
    for name in ["A", "B", "C", "D", "E", "F", "G"]:
        make_registration(tournament, f"Team {name}")

    ensure_bracket(tournament)

    byes = [
        match
        for match in tournament.matches.filter(round_index=0)
        if match.winner is not None
    ]
    assert len(byes) == 1
    assert byes[0].team_a.name == "Team G"
    assert byes[0].status == TournamentMatch.Status.FINISHED


def test_six_teams_get_one_second_round_bye(monkeypatch):
    monkeypatch.setattr(
        "backend.tournaments.bracket.random.shuffle",
        lambda teams: None,
    )
    tournament = make_tournament(total_slots=8)
    for name in ["A", "B", "C", "D", "E", "F"]:
        make_registration(tournament, f"Team {name}")

    ensure_bracket(tournament)
    first_round = tournament.matches.filter(round_index=0).order_by("position")
    assert [match.winner_id for match in first_round] == [None] * 4

    for match in first_round[:3]:
        match.winner = match.team_a
        match.status = TournamentMatch.Status.FINISHED
        match.save(update_fields=["winner", "status"])

    advance_winners(tournament)
    advance_winners(tournament)

    second_round = tournament.matches.filter(round_index=1).order_by("position")
    assert second_round[1].winner == second_round[1].team_a
    assert second_round[1].status == TournamentMatch.Status.FINISHED
