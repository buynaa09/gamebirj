from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from backend.tournaments import bracket as bracket_mod
from backend.tournaments.bracket import close_tournament_if_decided
from backend.tournaments.bracket import ensure_bracket
from backend.tournaments.bracket import poll_match_results
from backend.tournaments.bracket import resolve_winner_from_battle
from backend.tournaments.match_tools import MatchState
from backend.tournaments.models import MLBBMatchConfig
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentMatch
from backend.tournaments.tests.test_bracket import make_registration
from backend.tournaments.tests.test_bracket import make_tournament

pytestmark = pytest.mark.django_db


def make_polled_match(tournament, nick_a="ProA", nick_b="ProB"):
    """A 2-slot final with a room, teams seated, nicknames set."""
    for name in ["Team A", "Team B"]:
        make_registration(tournament, name)
    ensure_bracket(tournament)
    match = tournament.matches.get(round_index=0, position=0)
    match.team_a.leader_nickname = nick_a
    match.team_a.save(update_fields=["leader_nickname"])
    match.team_b.leader_nickname = nick_b
    match.team_b.save(update_fields=["leader_nickname"])
    match.mlbb_match_id = "poll123"
    match.draft_url = "https://s.mobilelegends.com/xyz"
    match.status = TournamentMatch.Status.OPEN
    match.save(update_fields=["mlbb_match_id", "draft_url", "status"])
    return match


def result_state(win_camp=1, players=None):
    return MatchState(
        url="",
        name="Final",
        status="result",
        is_closed=False,
        battle={
            "win_camp": win_camp,
            "player_list": players
            if players is not None
            else [
                {"name": "ProA", "camp": 1},
                {"name": "ProB", "camp": 2},
            ],
        },
    )


@pytest.fixture(autouse=True)
def seed_cookie():
    MLBBMatchConfig.objects.create(cookie="cookie-value")


@pytest.fixture
def fake_state(monkeypatch):
    calls: list[str] = []
    states: dict[str, MatchState] = {}

    def fake(match_id: str, cookie: str) -> MatchState:
        calls.append(match_id)
        assert cookie == "cookie-value"
        return states.get(
            match_id,
            MatchState(url="", name="", status="room", is_closed=False, battle={}),
        )

    monkeypatch.setattr(bracket_mod, "get_match_state", fake)
    return calls, states


def test_battle_state_marks_match_live(fake_state):
    calls, states = fake_state
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    states["poll123"] = MatchState(
        url="",
        name="Final",
        status="battle",
        is_closed=False,
        battle={},
    )

    summary = poll_match_results(tournament)

    match.refresh_from_db()
    assert calls == ["poll123"]
    assert match.status == TournamentMatch.Status.LIVE
    assert match.mlbb_status == "battle"
    assert summary["updated"] == 1
    assert summary["finished"] == 0


def test_result_auto_sets_winner_and_closes_tournament(fake_state):
    _, states = fake_state
    tournament = make_tournament(total_slots=2, status=Tournament.Status.LIVE)
    match = make_polled_match(tournament)
    states["poll123"] = result_state()

    summary = poll_match_results(tournament)

    match.refresh_from_db()
    tournament.refresh_from_db()
    assert match.winner == match.team_a
    assert match.status == TournamentMatch.Status.FINISHED
    assert match.mlbb_status == "result"
    assert match.battle_data["win_camp"] == 1
    assert tournament.status == Tournament.Status.FINISHED
    assert summary["finished"] == 1


def test_result_maps_winner_to_team_b(fake_state):
    _, states = fake_state
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    states["poll123"] = result_state(
        win_camp=2,
        players=[{"name": "ProA", "camp": 1}, {"name": "ProB", "camp": 2}],
    )

    poll_match_results(tournament)

    match.refresh_from_db()
    assert match.winner == match.team_b


def test_ambiguous_result_leaves_winner_for_staff(fake_state):
    _, states = fake_state
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    states["poll123"] = result_state(win_camp=1, players=[])

    summary = poll_match_results(tournament)

    match.refresh_from_db()
    assert match.winner is None
    assert match.status != TournamentMatch.Status.FINISHED
    assert summary["finished"] == 0
    assert summary["errors"]


def test_finished_and_fresh_matches_are_skipped(fake_state):
    calls, _ = fake_state
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    match.status = TournamentMatch.Status.FINISHED
    match.last_polled_at = timezone.now()
    match.save(update_fields=["status", "last_polled_at"])

    summary = poll_match_results(tournament)

    assert calls == []
    assert summary["polled"] == 0


def test_recently_polled_match_is_skipped(fake_state):
    calls, states = fake_state
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    match.last_polled_at = timezone.now() - timedelta(seconds=10)
    match.save(update_fields=["last_polled_at"])
    states["poll123"] = MatchState(
        url="",
        name="Final",
        status="battle",
        is_closed=False,
        battle={},
    )

    summary = poll_match_results(tournament)

    assert calls == []
    assert summary["polled"] == 0


@pytest.mark.usefixtures("fake_state")
def test_missing_cookie_reports_error():
    MLBBMatchConfig.objects.all().delete()
    tournament = make_tournament(total_slots=2)
    make_polled_match(tournament)

    summary = poll_match_results(tournament)

    assert summary["polled"] == 0
    assert summary["errors"]


def test_resolve_winner_case_insensitive():
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    battle = {
        "win_camp": 1,
        "player_list": [{"name": "proa", "camp": 1}, {"name": "PROB", "camp": 2}],
    }

    assert resolve_winner_from_battle(match, battle) == match.team_a


def test_resolve_winner_ambiguous_when_both_in_winning_camp():
    tournament = make_tournament(total_slots=2)
    match = make_polled_match(tournament)
    battle = {
        "win_camp": 1,
        "player_list": [{"name": "ProA", "camp": 1}, {"name": "ProB", "camp": 1}],
    }

    assert resolve_winner_from_battle(match, battle) is None


def test_close_tournament_only_when_final_decided():
    tournament = make_tournament(total_slots=4)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")
    ensure_bracket(tournament)

    assert close_tournament_if_decided(tournament) is False
    semifinal = tournament.matches.get(round_index=0, position=0)
    semifinal.winner = semifinal.team_a
    semifinal.status = TournamentMatch.Status.FINISHED
    semifinal.save(update_fields=["winner", "status"])

    assert close_tournament_if_decided(tournament) is False

    final = tournament.matches.get(round_index=1, position=0)
    final.team_a = semifinal.team_a
    final.team_b = tournament.matches.get(round_index=0, position=1).team_a
    final.winner = final.team_a
    final.status = TournamentMatch.Status.FINISHED
    final.save(update_fields=["team_a", "team_b", "winner", "status"])

    assert close_tournament_if_decided(tournament) is True
    tournament.refresh_from_db()
    assert tournament.status == Tournament.Status.FINISHED


def test_poll_creates_next_round_room(monkeypatch, fake_state):
    calls, states = fake_state
    created: list[str] = []

    def fake_ensure(tournament):
        created.append(tournament.title)
        return 1, []

    monkeypatch.setattr(bracket_mod, "ensure_rooms", fake_ensure)
    tournament = make_tournament(total_slots=4, status=Tournament.Status.LIVE)
    for name in ["A", "B", "C", "D"]:
        make_registration(tournament, f"Team {name}")
    ensure_bracket(tournament)
    semifinal = tournament.matches.get(round_index=0, position=0)
    semifinal.team_a.leader_nickname = "ProA"
    semifinal.team_a.save(update_fields=["leader_nickname"])
    semifinal.team_b.leader_nickname = "ProB"
    semifinal.team_b.save(update_fields=["leader_nickname"])
    semifinal.mlbb_match_id = "semi1"
    semifinal.status = TournamentMatch.Status.OPEN
    semifinal.save(update_fields=["mlbb_match_id", "status"])
    states["semi1"] = result_state()

    summary = poll_match_results(tournament)

    semifinal.refresh_from_db()
    assert semifinal.winner == semifinal.team_a
    assert created == [tournament.title]
    assert summary["rooms"] == 1
    assert calls == ["semi1"]
