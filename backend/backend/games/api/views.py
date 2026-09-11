from __future__ import annotations

from django.db.models import Prefetch
from ninja import Router

from backend.games.api.schema import GameSchema
from backend.games.models import Game
from backend.games.models import Listing

router = Router(tags=["games"])

# Covered by the top-level Rank / Level dropdown, so it is excluded here
# to avoid showing two rank inputs.
RANK_TITLE = "rank / level"


def _listing_payload(listing: Listing) -> dict:
    return {
        "id": listing.id,
        "title": listing.title,
        "listing_type": listing.listing_type,
        "place_holder_value": listing.place_holder_value,
        "choices": [c.choice_value for c in listing.choices.all()],
    }


def _game_payload(request, game: Game, global_listings: list[Listing]) -> dict:
    specific = list(game.listings.all())
    specific_titles = {listing.title.lower() for listing in specific}
    # A game-specific field shadows the global fallback with the same title.
    applicable = specific + [
        listing
        for listing in global_listings
        if listing.title.lower() not in specific_titles
    ]
    listings = [
        listing for listing in applicable if listing.title.lower() != RANK_TITLE
    ]
    listings.sort(key=lambda item: (item.game_id is None, item.id))
    image = request.build_absolute_uri(game.image.url) if game.image else None
    return {
        "id": game.id,
        "name": game.name,
        # Absolute URLs: the SPA runs on a different origin in dev,
        # so relative /media/... paths would resolve against Vite and 404.
        "image": image,
        "ranks": [rank.name for rank in game.ranks.all()],
        "listings": [_listing_payload(listing) for listing in listings],
    }


@router.get("/", response=list[GameSchema], auth=None)
def list_games(request):
    games = Game.objects.prefetch_related(
        "ranks",
        Prefetch("listings__choices"),
    ).all()
    global_listings = list(
        Listing.objects.filter(game__isnull=True).prefetch_related("choices").all(),
    )
    return [_game_payload(request, game, global_listings) for game in games]
