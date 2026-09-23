from __future__ import annotations

import logging

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from backend.tournaments.api.schema import CheckedAccountSchema
from backend.tournaments.api.schema import CheckIdSchema
from backend.tournaments.api.schema import RegisterTeamSchema
from backend.tournaments.api.schema import RegistrationSchema
from backend.tournaments.api.schema import TournamentSchema
from backend.tournaments.id_check import IdCheckNotFoundError
from backend.tournaments.id_check import IdCheckTransportError
from backend.tournaments.id_check import IdCheckUnsupportedError
from backend.tournaments.id_check import check_game_account
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentRegistration

logger = logging.getLogger(__name__)

router = Router(tags=["tournaments"])


def _get_tournament(tournament_id: int) -> Tournament:
    return get_object_or_404(
        Tournament,
        pk=tournament_id,
        is_active=True,
        game__is_active_tournament=True,
    )


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
            "format": tournament.format,
            "total_slots": tournament.total_slots,
            "filled_slots": tournament.filled_slots,
            "slot_unit": tournament.slot_unit,
        }
        for tournament in tournaments
    ]


@router.post("/check-id/", response=CheckedAccountSchema)
def check_leader_id(request, data: CheckIdSchema):
    tournament = _get_tournament(data.tournament_id)
    slug = tournament.game.id_check_slug
    if not slug:
        raise HttpError(400, "ID check is not supported for this game.")
    try:
        account = check_game_account(slug, data.user_id, data.server_id)
    except IdCheckUnsupportedError as exc:
        raise HttpError(400, "ID check is not supported for this game.") from exc
    except IdCheckNotFoundError as exc:
        raise HttpError(422, "Game account not found. Check the ID.") from exc
    except IdCheckTransportError as exc:
        raise HttpError(502, "ID checker is unreachable. Try again.") from exc
    return {"nickname": account.nickname, "region": account.region}


@router.post("/{tournament_id}/register/", response=RegistrationSchema)
def register_team(request, tournament_id: int, data: RegisterTeamSchema):
    tournament = _get_tournament(tournament_id)
    if tournament.status != Tournament.Status.OPEN:
        raise HttpError(400, "Registration is closed for this tournament.")
    team_name = data.team_name.strip()
    leader_game_id = data.leader_game_id.strip()
    leader_server_id = data.leader_server_id.strip()
    leader_nickname = data.leader_nickname.strip()
    if not team_name or not leader_game_id:
        raise HttpError(422, "Team name and leader game ID are required.")
    if tournament.filled_slots >= tournament.total_slots:
        raise HttpError(400, "This tournament is full.")
    slug = tournament.game.id_check_slug
    if slug:
        if not leader_server_id:
            raise HttpError(422, "Server ID is required for this game.")
        try:
            account = check_game_account(slug, leader_game_id, leader_server_id)
        except (IdCheckUnsupportedError, IdCheckTransportError) as exc:
            # Third-party outage must not block registration; the
            # pre-submit browser check already confirmed the account.
            logger.warning("ID_CHECK re-check skipped for %s: %s", tournament, exc)
        except IdCheckNotFoundError as exc:
            raise HttpError(422, "Leader game account not found.") from exc
        else:
            leader_nickname = account.nickname
    try:
        registration = TournamentRegistration.objects.create(
            tournament=tournament,
            user=request.user,
            team_name=team_name,
            leader_game_id=leader_game_id,
            leader_server_id=leader_server_id,
            leader_nickname=leader_nickname,
        )
    except IntegrityError as exc:
        raise HttpError(409, "This team is already registered.") from exc
    tournament.filled_slots += 1
    tournament.save(update_fields=["filled_slots"])
    return {
        "id": registration.id,
        "tournament": tournament.id,
        "team_name": registration.team_name,
        "leader_game_id": registration.leader_game_id,
        "leader_server_id": registration.leader_server_id,
        "leader_nickname": registration.leader_nickname,
        "created_at": registration.created_at.isoformat(),
    }
