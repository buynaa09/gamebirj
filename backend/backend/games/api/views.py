from __future__ import annotations

from ninja import Router

from backend.games.api.schema import GameSchema
from backend.games.models import Game

router = Router(tags=["games"])


@router.get("/", response=list[GameSchema], auth=None)
def list_games(request):
    # Absolute URLs: the SPA runs on a different origin in dev,
    # so relative /media/... paths would resolve against Vite and 404.
    return [
        {
            "id": game.id,
            "name": game.name,
            "image": request.build_absolute_uri(game.image.url) if game.image else None,
        }
        for game in Game.objects.all()
    ]
