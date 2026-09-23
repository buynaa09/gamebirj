from __future__ import annotations

from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from backend.tournaments.api.schema import RegisterTeamSchema
from backend.tournaments.api.schema import RegistrationSchema
from backend.tournaments.api.schema import TournamentSchema
from backend.tournaments.models import Tournament
from backend.tournaments.models import TournamentRegistration

router = Router(tags=["tournaments"])


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


@router.post("/{tournament_id}/register/", response=RegistrationSchema)
def register_team(request, tournament_id: int, data: RegisterTeamSchema):
    tournament = get_object_or_404(
        Tournament,
        pk=tournament_id,
        is_active=True,
        game__is_active_tournament=True,
    )
    if tournament.status != Tournament.Status.OPEN:
        raise HttpError(400, "Registration is closed for this tournament.")
    team_name = data.team_name.strip()
    leader_game_id = data.leader_game_id.strip()
    if not team_name or not leader_game_id:
        raise HttpError(422, "Team name and leader game ID are required.")
    if tournament.filled_slots >= tournament.total_slots:
        raise HttpError(400, "This tournament is full.")
    try:
        registration = TournamentRegistration.objects.create(
            tournament=tournament,
            user=request.user,
            team_name=team_name,
            leader_game_id=leader_game_id,
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
        "created_at": registration.created_at.isoformat(),
    }
