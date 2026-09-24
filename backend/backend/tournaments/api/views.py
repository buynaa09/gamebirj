from __future__ import annotations

import logging

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from backend.games.models import Game
from backend.tournaments.api.schema import CheckedAccountSchema
from backend.tournaments.api.schema import CheckIdSchema
from backend.tournaments.api.schema import CreateTeamSchema
from backend.tournaments.api.schema import RegisterTeamSchema
from backend.tournaments.api.schema import RegistrationSchema
from backend.tournaments.api.schema import TournamentDetailSchema
from backend.tournaments.api.schema import TournamentSchema
from backend.tournaments.api.schema import TournamentTeamSchema
from backend.tournaments.id_check import IdCheckNotFoundError
from backend.tournaments.id_check import IdCheckTransportError
from backend.tournaments.id_check import IdCheckUnsupportedError
from backend.tournaments.id_check import check_game_account
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentRegistration
from backend.tournaments.models import TournamentTeam

logger = logging.getLogger(__name__)

router = Router(tags=["tournaments"])


def _get_tournament(tournament_id: int) -> Tournament:
    return get_object_or_404(
        Tournament,
        pk=tournament_id,
        is_active=True,
        game__is_active_tournament=True,
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
    tournament.filled_slots += 1
    tournament.save(update_fields=["filled_slots"])
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
