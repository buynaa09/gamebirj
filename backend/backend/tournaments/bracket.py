"""Single-elimination bracket generation and automatic MLBB room creation.

``ensure_bracket`` builds every round's fixtures and randomly seats round 0
from registrations; late registrations fill remaining empty seats.
``advance_winners`` propagates staff-set winners into the next round.
``ensure_rooms`` creates matchTools lobbies for fixtures with both teams
known. All three are idempotent and safe to run on every matches fetch.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime
from datetime import timedelta

from django.utils import timezone

from backend.tournaments.match_tools import MatchToolsError
from backend.tournaments.match_tools import create_lobby
from backend.tournaments.match_tools import get_lobby_url
from backend.tournaments.match_tools import get_match_state
from backend.tournaments.models import MLBBMatchConfig
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentMatch
from backend.tournaments.models import TournamentTeam

logger = logging.getLogger(__name__)


MIN_BRACKET_SIZE = 2
FEEDER_COUNT = 2
# Minimum age of last_polled_at before a room is polled again. The cron job
# runs every minute; this guard also makes ad-hoc runs cheap and idempotent.
POLL_INTERVAL_SECONDS = 60


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
    _apply_automatic_byes(tournament)
    advance_winners(tournament)
    _apply_automatic_byes(tournament)
    advance_winners(tournament)
    return list(tournament.matches.select_related("team_a", "team_b", "winner"))


def seat_first_round(tournament: Tournament) -> None:
    """Seat registered teams in random order into empty round-0 slots."""
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
    random.shuffle(pending_teams)
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


def _tournament_started(tournament: Tournament) -> bool:
    if tournament.status == Tournament.Status.LIVE:
        return True
    return (
        tournament.status == Tournament.Status.OPEN
        and tournament.starts_at is not None
        and tournament.starts_at <= timezone.now()
    )


def _has_teams(match: TournamentMatch) -> bool:
    return match.team_a_id is not None or match.team_b_id is not None


def _apply_automatic_byes(tournament: Tournament) -> bool:
    """Turn lone teams into direct wins once the tournament has started."""
    if not _tournament_started(tournament):
        return False
    registrations = tournament.registrations.count()
    changed = False
    for match in tournament.matches.filter(winner__isnull=True).order_by(
        "round_index",
        "position",
    ):
        if match.team_a_id and match.team_b_id:
            continue
        if not _has_teams(match):
            continue
        if match.round_index == 0:
            if registrations % 2:
                match.winner = match.team_a or match.team_b
                match.status = TournamentMatch.Status.FINISHED
                match.save(update_fields=["winner", "status"])
                changed = True
            continue
        feeder_positions = (match.position * 2, match.position * 2 + 1)
        feeders = list(
            tournament.matches.filter(
                round_index=match.round_index - 1,
                position__in=feeder_positions,
            ),
        )
        if (
            len(feeders) == FEEDER_COUNT
            and any(_has_teams(feeder) for feeder in feeders)
            and any(not _has_teams(feeder) for feeder in feeders)
        ):
            match.winner = match.team_a or match.team_b
            match.status = TournamentMatch.Status.FINISHED
            match.save(update_fields=["winner", "status"])
            changed = True
    return changed


def advance_winners(tournament: Tournament) -> None:
    """Push staff-set winners into the next round's empty slots.

    Matches with a winner are marked finished so they show up in history.
    """
    max_round = round_count(tournament.total_slots) - 1
    _apply_automatic_byes(tournament)
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
    if _apply_automatic_byes(tournament):
        advance_winners(tournament)


def lobby_deadline(tournament: Tournament) -> datetime:
    """Deadline for a freshly opened room: five minutes after it becomes
    available, never earlier than the tournament's scheduled start.

    Anchoring the deadline straight to ``starts_at`` would put it in the past
    for every round-0 room, because rooms are only created once the
    tournament has started — the lobby countdown would read "expired" on
    first render and ``poll_match_results`` would expire the fixture.
    """
    base = tournament.starts_at or timezone.now()
    return max(base, timezone.now()) + timedelta(minutes=5)


def ensure_rooms(tournament: Tournament) -> tuple[int, list[str]]:
    """Create lobbies for fixtures with both teams known. Returns (created, errors)."""
    cookie = MLBBMatchConfig.get_cookie()
    if not cookie:
        logger.warning(
            "No lobbies created for %s: matchTools cookie is not configured",
            tournament.pk,
        )
        return 0, ["matchTools cookie is not configured"]
    for match in tournament.matches.exclude(mlbb_match_id="").filter(
        lobby_deadline__isnull=True,
    ):
        match.lobby_deadline = lobby_deadline(tournament)
        match.save(update_fields=["lobby_deadline"])
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
        match.lobby_deadline = lobby_deadline(tournament)
        match.status = TournamentMatch.Status.OPEN
        match.save(
            update_fields=["mlbb_match_id", "draft_url", "lobby_deadline", "status"],
        )
        created += 1
    return created, errors


def _camp_map(players: object) -> dict[str, int]:
    """Map player name → camp number from a battleData player_list."""
    camps: dict[str, int] = {}
    if not isinstance(players, list):
        return camps
    for player in players:
        if not isinstance(player, dict):
            continue
        name = str(player.get("name") or "").strip()
        try:
            camp = int(player.get("camp") or 0)
        except (TypeError, ValueError):
            continue
        if name and camp > 0 and name not in camps:
            camps[name] = camp
    return camps


def _camp_of(camps: dict[str, int], nickname: str) -> int | None:
    """Find a team's camp by leader nickname (case-insensitive fallback)."""
    nickname = (nickname or "").strip()
    if not nickname:
        return None
    if nickname in camps:
        return camps[nickname]
    lowered = nickname.lower()
    for name, camp in camps.items():
        if name.lower() == lowered:
            return camp
    return None


def resolve_winner_from_battle(
    match: TournamentMatch,
    battle: dict,
) -> TournamentTeam | None:
    """Map a ``result`` battleData payload to the winning team.

    ``win_camp`` tells which in-game camp won; each ``player_list`` entry
    carries ``camp`` and ``name``. A team is linked to a camp through its
    leader's nickname snapshot. Returns the winner only when exactly one of
    the two teams sits in the winning camp — anything ambiguous returns
    ``None`` so staff can decide in admin.
    """
    try:
        win_camp = int(battle.get("win_camp") or 0)
    except TypeError, ValueError:
        return None
    if win_camp <= 0 or match.team_a is None or match.team_b is None:
        return None
    camps = _camp_map(battle.get("player_list"))
    if not camps:
        return None
    camp_a = _camp_of(camps, match.team_a.leader_nickname)
    camp_b = _camp_of(camps, match.team_b.leader_nickname)
    if camp_a == win_camp and camp_b != win_camp:
        return match.team_a
    if camp_b == win_camp and camp_a != win_camp:
        return match.team_b
    return None


def poll_match_results(tournament: Tournament | None = None) -> dict:
    """Poll matchTools for open rooms and advance the bracket.

    Updates ``mlbb_status``/``battle_data``/``draft_url``, maps room states
    (``create``/``room`` → open, ``battle`` → live), auto-sets unambiguous
    winners on ``result`` (propagating them via ``advance_winners`` and
    creating next-round rooms), and marks tournaments with a decided final
    as finished. Safe to run every minute; rooms polled within
    ``POLL_INTERVAL_SECONDS`` are skipped.
    """
    summary: dict = {"polled": 0, "updated": 0, "finished": 0, "rooms": 0, "errors": []}
    cookie = MLBBMatchConfig.get_cookie()
    if not cookie:
        summary["errors"].append("matchTools cookie is not configured")
        return summary
    matches = (
        TournamentMatch.objects.exclude(mlbb_match_id="")
        .exclude(
            status__in=[
                TournamentMatch.Status.FINISHED,
                TournamentMatch.Status.EXPIRED,
            ],
        )
        .select_related("team_a", "team_b", "tournament")
        .order_by("tournament_id", "round_index", "position")
    )
    if tournament is not None:
        matches = matches.filter(tournament=tournament)
    cutoff = timezone.now() - timedelta(seconds=POLL_INTERVAL_SECONDS)
    touched_tournaments: dict[int, Tournament] = {}
    for match in matches:
        if (
            match.lobby_deadline is not None
            and match.lobby_deadline <= timezone.now()
            and match.winner_id is None
            # A match already under way has passed the "start within five
            # minutes" bar; expiring it would drop the live result.
            and match.status
            not in (TournamentMatch.Status.FINISHED, TournamentMatch.Status.LIVE)
        ):
            match.status = TournamentMatch.Status.EXPIRED
            match.is_expired = True
            match.save(update_fields=["status", "is_expired"])
            logger.info("Match deadline expired: %s", match)
            continue
        if match.last_polled_at is not None and match.last_polled_at >= cutoff:
            continue
        _poll_one_match(match, cookie, summary)
        touched_tournaments[match.tournament_id] = match.tournament
    for touched in touched_tournaments.values():
        advance_winners(touched)
        created, errors = ensure_rooms(touched)
        summary["rooms"] += created
        summary["errors"].extend(errors)
        close_tournament_if_decided(touched)
    return summary


def _poll_one_match(
    match: TournamentMatch,
    cookie: str,
    summary: dict,
) -> None:
    """Poll one room and apply its state; records errors into summary."""
    label = f"{match.tournament.title} R{match.round_index + 1}M{match.position + 1}"
    now = timezone.now()
    try:
        state = get_match_state(match.mlbb_match_id, cookie)
    except MatchToolsError as exc:
        logger.warning("Result poll failed for %s: %s", label, exc)
        summary["errors"].append(f"{label}: {exc}")
        match.last_polled_at = now
        match.save(update_fields=["last_polled_at"])
        return
    summary["polled"] += 1
    match.mlbb_status = state.status
    match.battle_data = state.battle
    match.last_polled_at = now
    fields = ["mlbb_status", "battle_data", "last_polled_at"]
    if state.url and state.url != match.draft_url:
        match.draft_url = state.url
        fields.append("draft_url")
    next_status = {
        "create": TournamentMatch.Status.OPEN,
        "room": TournamentMatch.Status.OPEN,
        "battle": TournamentMatch.Status.LIVE,
    }.get(state.status)
    if next_status is not None and match.status != next_status:
        match.status = next_status
        fields.append("status")
        summary["updated"] += 1
    if state.status == "result" and match.winner_id is None:
        _apply_result(match, state.battle, label, summary, fields)
    match.save(update_fields=fields)


def _apply_result(
    match: TournamentMatch,
    battle: dict,
    label: str,
    summary: dict,
    fields: list[str],
) -> None:
    """Auto-finish a ``result`` match when the winner is unambiguous."""
    winner = resolve_winner_from_battle(match, battle)
    if winner is None:
        logger.warning(
            "Ambiguous result for %s (win_camp=%s) — staff decision needed",
            label,
            battle.get("win_camp"),
        )
        summary["errors"].append(f"{label}: ambiguous result, staff needed")
        return
    match.winner = winner
    match.status = TournamentMatch.Status.FINISHED
    fields.extend(["winner", "status"])
    summary["finished"] += 1
    logger.info("Auto-finished %s: winner %s", label, winner.name)


def close_tournament_if_decided(tournament: Tournament) -> bool:
    """Mark the tournament finished once the final has a winner."""
    if tournament.status == Tournament.Status.FINISHED:
        return False
    final_round = round_count(tournament.total_slots) - 1
    try:
        final = tournament.matches.get(round_index=final_round, position=0)
    except TournamentMatch.DoesNotExist:
        return False
    if final.winner_id is None:
        return False
    tournament.status = Tournament.Status.FINISHED
    tournament.save(update_fields=["status"])
    logger.info("Tournament finished: %s", tournament.title)
    return True
