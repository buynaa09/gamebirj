from __future__ import annotations

import logging

from django.db import IntegrityError
from django.db.models import F
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from backend.games.models import Game
from backend.tournaments.api.schema import CheckedAccountSchema
from backend.tournaments.api.schema import CheckIdSchema
from backend.tournaments.api.schema import CreateTeamSchema
from backend.tournaments.api.schema import EnsureRoomsSchema
from backend.tournaments.api.schema import RegisterTeamSchema
from backend.tournaments.api.schema import RegistrationSchema
from backend.tournaments.api.schema import TournamentDetailSchema
from backend.tournaments.api.schema import TournamentMatchSchema
from backend.tournaments.api.schema import TournamentSchema
from backend.tournaments.api.schema import TournamentTeamSchema
from backend.tournaments.bracket import ensure_bracket
from backend.tournaments.bracket import ensure_rooms
from backend.tournaments.id_check import IdCheckNotFoundError
from backend.tournaments.id_check import IdCheckTransportError
from backend.tournaments.id_check import IdCheckUnsupportedError
from backend.tournaments.id_check import check_game_account
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentRegistration
from backend.tournaments.models import TournamentTeam
from backend.users.clerk_auth import get_user_from_token

logger = logging.getLogger(__name__)

router = Router(tags=["tournaments"])


def _get_tournament(tournament_id: int) -> Tournament:
    return get_object_or_404(
        Tournament,
        pk=tournament_id,
        is_active=True,
        game__is_active_tournament=True,
    )


def _optional_user(request):
    """User for public (auth=None) endpoints.

    The SPA always sends its Clerk JWT, which takes precedence — a Django
    session cookie may belong to a different (e.g. staff) account in the
    same browser and must not shadow the Clerk identity.
    """
    auth = request.headers.get("Authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() == "bearer" and token.strip():
        resolved = get_user_from_token(token.strip())
        if resolved is not None:
            return resolved
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def _registered_tournament_ids(request) -> set[int]:
    """IDs of tournaments the current user has joined (empty when anonymous)."""
    user = _optional_user(request)
    if user is None:
        return set()
    return set(
        TournamentRegistration.objects.filter(user=user).values_list(
            "tournament_id", flat=True,
        ),
    )


def _verify_leader(slug: str, leader_game_id: str, leader_server_id: str) -> str:
    """Return the verified nickname, raising HttpError when invalid.

    Transport failures fail open (the browser pre-check already confirmed
    the account); a definitive miss fails closed.
    """
    try:
        return check_game_account(slug, leader_game_id, leader_server_id).nickname
    except (IdCheckUnsupportedError, IdCheckTransportError) as exc:
        logger.warning("Leader ID re-check skipped: %s", exc)
        return ""
    except IdCheckNotFoundError as exc:
        raise HttpError(422, "Leader game account not found.") from exc


def _team_payload(team: TournamentTeam) -> dict:
    return {
        "id": team.id,
        "game_id": team.game_id,
        "game": team.game.name,
        "name": team.name,
        "leader_game_id": team.leader_game_id,
        "leader_server_id": team.leader_server_id,
        "leader_nickname": team.leader_nickname,
        "created_at": team.created_at.isoformat(),
    }


@router.get("/", response=list[TournamentSchema], auth=None)
def list_tournaments(request):
    tournaments = Tournament.objects.filter(
        is_active=True,
        game__is_active_tournament=True,
    ).select_related("game")
    registered = _registered_tournament_ids(request)
    return [
        {
            "id": tournament.id,
            "title": tournament.title,
            "game_id": tournament.game_id,
            "game": tournament.game.name,
            "id_check_slug": tournament.game.id_check_slug,
            "status": tournament.status,
            "prize_pool": tournament.prize_pool,
            "entry_fee": tournament.entry_fee,
            "starts_at": tournament.starts_at.isoformat()
            if tournament.starts_at
            else None,
            "ends_at": tournament.ends_at.isoformat() if tournament.ends_at else None,
            "format": tournament.format,
            "mode": tournament.mode,
            "team_size": tournament.team_size,
            "rules": tournament.rules,
            "total_slots": tournament.total_slots,
            "filled_slots": tournament.filled_slots,
            "slot_unit": tournament.slot_unit,
            "is_registered": tournament.id in registered,
        }
        for tournament in tournaments
    ]


@router.get("/teams/", response=list[TournamentTeamSchema])
def list_my_teams(request, game: int):
    teams = TournamentTeam.objects.filter(
        owner=request.user,
        game_id=game,
    ).select_related("game")
    return [_team_payload(team) for team in teams]


@router.post("/teams/", response=TournamentTeamSchema)
def create_team(request, data: CreateTeamSchema):
    game = get_object_or_404(Game, pk=data.game_id, is_active_tournament=True)
    name = data.name.strip()
    leader_game_id = data.leader_game_id.strip()
    leader_server_id = data.leader_server_id.strip()
    if not name or not leader_game_id:
        raise HttpError(422, "Team name and leader game ID are required.")
    slug = game.id_check_slug
    nickname = ""
    if slug:
        if not leader_server_id:
            raise HttpError(422, "Server ID is required for this game.")
        nickname = _verify_leader(slug, leader_game_id, leader_server_id)
        if not nickname:
            # Re-check above fails open on transport errors; without a
            # confirmed nickname the team cannot be created blindly.
            raise HttpError(422, "Leader game account could not be verified.")
    try:
        team = TournamentTeam.objects.create(
            game=game,
            owner=request.user,
            name=name,
            leader_game_id=leader_game_id,
            leader_server_id=leader_server_id,
            leader_nickname=nickname or data.leader_nickname.strip(),
        )
    except IntegrityError as exc:
        raise HttpError(409, "You already have a team for this game.") from exc
    return _team_payload(team)


@router.post("/check-id/", response=CheckedAccountSchema)
def check_leader_id(request, data: CheckIdSchema):
    tournament = _get_tournament(data.tournament_id)
    slug = tournament.game.id_check_slug
    if not slug:
        raise HttpError(400, "Энэ тоглоомд ID шалгах боломжгүй байна.")
    try:
        account = check_game_account(slug, data.user_id, data.server_id)
    except IdCheckUnsupportedError as exc:
        raise HttpError(400, "Энэ тоглоомд ID шалгах боломжгүй байна.") from exc
    except IdCheckNotFoundError as exc:
        raise HttpError(422, "Тоглоомын акаунт олдсонгүй. ID-гаа шалгана уу.") from exc
    except IdCheckTransportError as exc:
        raise HttpError(502, "ID шалгагчтай холбогдож чадсангүй. Дахин оролдоно уу.") from exc
    return {"nickname": account.nickname, "region": account.region}


@router.post("/{tournament_id}/register/", response=RegistrationSchema)
def register_team(request, tournament_id: int, data: RegisterTeamSchema):
    tournament = _get_tournament(tournament_id)
    if tournament.status != Tournament.Status.OPEN:
        raise HttpError(400, "Registration is closed for this tournament.")
    if _tournament_started(tournament):
        raise HttpError(400, "This tournament has already started.")
    team = get_object_or_404(TournamentTeam, pk=data.team_id, owner=request.user)
    if team.game_id != tournament.game_id:
        raise HttpError(400, "This team plays a different game.")
    if tournament.filled_slots >= tournament.total_slots:
        raise HttpError(400, "This tournament is full.")
    try:
        registration = TournamentRegistration.objects.create(
            tournament=tournament,
            user=request.user,
            team=team,
        )
    except IntegrityError as exc:
        raise HttpError(409, "This team is already registered.") from exc
    # Atomic increment — concurrent registrations never lose a count.
    Tournament.objects.filter(pk=tournament.pk).update(filled_slots=F("filled_slots") + 1)
    tournament.refresh_from_db(fields=["filled_slots"])
    return {
        "id": registration.id,
        "tournament": tournament.id,
        "team_id": team.id,
        "team_name": team.name,
        "leader_game_id": team.leader_game_id,
        "leader_server_id": team.leader_server_id,
        "leader_nickname": team.leader_nickname,
        "created_at": registration.created_at.isoformat(),
    }


@router.get("/{tournament_id}/", response=TournamentDetailSchema, auth=None)
def retrieve_tournament(request, tournament_id: int):
    tournament = _get_tournament(tournament_id)
    registrations = tournament.registrations.select_related("team").order_by(
        "created_at",
    )
    user = _optional_user(request)
    is_registered = tournament.id in _registered_tournament_ids(request)
    my_match = _my_next_match(tournament, user)
    my_draft_url = _my_draft_url(tournament, user)
    return {
        "id": tournament.id,
        "title": tournament.title,
        "game_id": tournament.game_id,
        "game": tournament.game.name,
        "id_check_slug": tournament.game.id_check_slug,
        "status": tournament.status,
        "prize_pool": tournament.prize_pool,
        "entry_fee": tournament.entry_fee,
        "starts_at": tournament.starts_at.isoformat() if tournament.starts_at else None,
        "ends_at": tournament.ends_at.isoformat() if tournament.ends_at else None,
        "format": tournament.format,
        "mode": tournament.mode,
        "team_size": tournament.team_size,
        "rules": tournament.rules,
        "total_slots": tournament.total_slots,
        "filled_slots": tournament.filled_slots,
        "slot_unit": tournament.slot_unit,
        "is_registered": is_registered,
        "my_draft_url": my_draft_url,
        "my_match_status": (
            (my_match.mlbb_status or my_match.status) if my_match else None
        ),
        # Leader game IDs stay private; only nicknames are public.
        "registrations": [
            {
                "team_name": registration.team.name,
                "leader_nickname": registration.team.leader_nickname,
                "created_at": registration.created_at.isoformat(),
            }
            for registration in registrations
        ],
    }


def _my_next_match(tournament: Tournament, user):
    """The viewer's next unresolved match, if one exists."""
    my_team_ids = _my_team_ids(tournament, user)
    if not my_team_ids:
        return None
    return (
        tournament.matches.filter(
            Q(team_a_id__in=my_team_ids) | Q(team_b_id__in=my_team_ids),
            winner__isnull=True,
        )
        .select_related("team_a", "team_b")
        .order_by("round_index", "position")
        .first()
    )


def _my_draft_url(tournament: Tournament, user) -> str | None:
    """The viewer's own upcoming lobby link, if any of their matches is open."""
    my_team_ids = _my_team_ids(tournament, user)
    if not my_team_ids:
        return None
    open_matches = (
        tournament.matches.filter(winner__isnull=True)
        .exclude(draft_url="")
        .order_by("round_index", "position")
    )
    for match in open_matches:
        if match.team_a_id in my_team_ids or match.team_b_id in my_team_ids:
            return match.draft_url or None
    return None


def _tournament_started(tournament: Tournament) -> bool:
    if tournament.status == Tournament.Status.LIVE:
        return True
    if tournament.status != Tournament.Status.OPEN or not tournament.starts_at:
        return False
    return tournament.starts_at <= timezone.now()


def _my_team_ids(tournament: Tournament, user) -> set[int]:
    if user is None:
        return set()
    team_ids = set(
        TournamentTeam.objects.filter(owner=user).values_list("id", flat=True),
    )
    team_ids |= set(
        TournamentRegistration.objects.filter(
            tournament=tournament, user=user,
        ).values_list("team_id", flat=True),
    )
    return team_ids


def _match_payloads(request, tournament: Tournament) -> list[dict]:
    user = _optional_user(request)
    staff = user is not None and getattr(user, "is_staff", False)
    my_team_ids = _my_team_ids(tournament, user)
    payloads = []
    for match in tournament.matches.select_related("team_a", "team_b", "winner"):
        may_join = staff or (
            match.team_a_id in my_team_ids or match.team_b_id in my_team_ids
        )
        payloads.append(
            {
                "id": match.id,
                "round_index": match.round_index,
                "position": match.position,
                "team_a": match.team_a.name if match.team_a else None,
                "team_b": match.team_b.name if match.team_b else None,
                "winner": match.winner.name if match.winner else None,
                "score_a": match.score_a,
                "score_b": match.score_b,
                "status": match.status,
                "mlbb_status": match.mlbb_status,
                "has_room": bool(match.mlbb_match_id),
                "draft_url": (
                    match.draft_url if (may_join and match.draft_url) else None
                ),
            },
        )
    return payloads


@router.get(
    "/{tournament_id}/matches/",
    response=list[TournamentMatchSchema],
    auth=None,
)
def list_matches(request, tournament_id: int):
    tournament = _get_tournament(tournament_id)
    ensure_bracket(tournament)
    # Automatic room creation once the tournament has begun; idempotent and
    # silent on provider errors (rooms stay pending, details in server logs).
    if _tournament_started(tournament):
        ensure_rooms(tournament)
    return _match_payloads(request, tournament)


@router.post("/{tournament_id}/matches/ensure/", response=EnsureRoomsSchema)
def ensure_match_rooms(request, tournament_id: int):
    if not getattr(request.user, "is_staff", False):
        raise HttpError(403, "Staff only.")
    tournament = _get_tournament(tournament_id)
    ensure_bracket(tournament)
    created, errors = ensure_rooms(tournament)
    return {"created": created, "errors": errors}
