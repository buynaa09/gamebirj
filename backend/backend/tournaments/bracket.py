"""Single-elimination bracket generation and automatic MLBB room creation.

``ensure_bracket`` builds every round's fixtures and seats round 0 from
registrations (registration order); late registrations fill remaining empty
seats. ``advance_winners`` propagates staff-set winners into the next round.
``ensure_rooms`` creates matchTools lobbies for fixtures with both teams
known. All three are idempotent and safe to run on every matches fetch.
"""

from __future__ import annotations

import logging

from backend.tournaments.match_tools import MatchToolsError
from backend.tournaments.match_tools import create_lobby
from backend.tournaments.match_tools import get_lobby_url
from backend.tournaments.models import MLBBMatchConfig
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentMatch

logger = logging.getLogger(__name__)


MIN_BRACKET_SIZE = 2


def bracket_size(total_slots: int) -> int:
    size = MIN_BRACKET_SIZE
    target = max(MIN_BRACKET_SIZE, total_slots)
    while size < target:
        size *= 2
    return size


def round_count(total_slots: int) -> int:
    rounds = 0
    size = bracket_size(total_slots)
    while size >= MIN_BRACKET_SIZE:
        rounds += 1
        size //= MIN_BRACKET_SIZE
    return rounds


def lobby_name(tournament: Tournament, round_index: int, position: int) -> str:
    return f"{tournament.title} · R{round_index + 1}M{position + 1}"[:100]


def ensure_bracket(tournament: Tournament) -> list[TournamentMatch]:
    """Create all fixtures (if missing) and seat known teams. Returns matches."""
    if not tournament.matches.exists():
        size = bracket_size(tournament.total_slots)
        matches = size // MIN_BRACKET_SIZE
        bulk = [
            TournamentMatch(
                tournament=tournament,
                round_index=round_index,
                position=position,
            )
            for round_index in range(round_count(tournament.total_slots))
            for position in range(matches >> round_index)
        ]
        TournamentMatch.objects.bulk_create(bulk)

    seat_first_round(tournament)
    advance_winners(tournament)
    return list(tournament.matches.select_related("team_a", "team_b", "winner"))


def seat_first_round(tournament: Tournament) -> None:
    """Seat registrations (oldest first) into empty round-0 slots."""
    seated_ids = set(
        tournament.matches.filter(round_index=0)
        .exclude(team_a__isnull=True)
        .values_list("team_a_id", flat=True),
    )
    seated_ids |= set(
        tournament.matches.filter(round_index=0)
        .exclude(team_b__isnull=True)
        .values_list("team_b_id", flat=True),
    )
    pending_teams = [
        registration.team_id
        for registration in tournament.registrations.select_related(
            "team",
        ).order_by("created_at")
        if registration.team_id not in seated_ids
    ]
    if not pending_teams:
        return
    for match in tournament.matches.filter(round_index=0).order_by("position"):
        changed = False
        if match.team_a_id is None and pending_teams:
            match.team_a_id = pending_teams.pop(0)
            seated_ids.add(match.team_a_id)
            changed = True
        if match.team_b_id is None and pending_teams:
            match.team_b_id = pending_teams.pop(0)
            seated_ids.add(match.team_b_id)
            changed = True
        if changed:
            match.save(update_fields=["team_a", "team_b"])
        if not pending_teams:
            break


def advance_winners(tournament: Tournament) -> None:
    """Push staff-set winners into the next round's empty slots.

    Matches with a winner are marked finished so they show up in history.
    """
    max_round = round_count(tournament.total_slots) - 1
    for match in tournament.matches.exclude(winner__isnull=True).order_by(
        "round_index",
        "position",
    ):
        if match.status != TournamentMatch.Status.FINISHED:
            match.status = TournamentMatch.Status.FINISHED
            match.save(update_fields=["status"])
        if match.round_index >= max_round:
            continue
        try:
            nxt = tournament.matches.get(
                round_index=match.round_index + 1,
                position=match.position // 2,
            )
        except TournamentMatch.DoesNotExist:
            continue
        field = "team_a" if match.position % 2 == 0 else "team_b"
        if getattr(nxt, f"{field}_id") != match.winner_id:
            setattr(nxt, field, match.winner)
            nxt.save(update_fields=[field])


def ensure_rooms(tournament: Tournament) -> tuple[int, list[str]]:
    """Create lobbies for fixtures with both teams known. Returns (created, errors)."""
    cookie = MLBBMatchConfig.get_cookie()
    if not cookie:
        return 0, ["matchTools cookie is not configured"]
    created = 0
    errors: list[str] = []
    for match in tournament.matches.filter(mlbb_match_id="").order_by(
        "round_index",
        "position",
    ):
        if not match.both_teams_known:
            continue
        label = f"R{match.round_index + 1}M{match.position + 1}"
        try:
            room = create_lobby(
                lobby_name(tournament, match.round_index, match.position),
                cookie,
            )
            lobby = get_lobby_url(room.match_id, cookie)
        except MatchToolsError as exc:
            logger.warning(
                "Lobby creation failed for %s %s: %s",
                tournament.pk,
                label,
                exc,
            )
            errors.append(f"{label}: {exc}")
            continue
        match.mlbb_match_id = room.match_id
        match.draft_url = lobby.url
        match.status = TournamentMatch.Status.OPEN
        match.save(update_fields=["mlbb_match_id", "draft_url", "status"])
        created += 1
    return created, errors
