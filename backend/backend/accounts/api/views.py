from __future__ import annotations

import json
from decimal import Decimal
from decimal import InvalidOperation

from ninja import Form
from ninja import Router
from ninja.errors import HttpError

from backend.accounts.api.schema import AccountSchema
from backend.accounts.models import Account
from backend.games.models import Game
from backend.games.models import Listing

router = Router(tags=["accounts"])

MAX_IMAGES = 8


def _fail(status: int, message: str) -> HttpError:
    return HttpError(status, message)


def _parse_details(raw: str) -> list[dict]:
    if not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise _fail(422, "Field 'details' must be valid JSON.") from exc
    if not isinstance(data, list):
        raise _fail(422, "Field 'details' must be a list.")
    return data


def _listing_payload(account_listing) -> dict:
    return {
        "listing_id": account_listing.listing_id,
        "title": account_listing.listing.title,
        "value": account_listing.value,
        "choices": [c.choice_value for c in account_listing.choices.all()],
    }


def _account_payload(request, account: Account) -> dict:
    images = [
        {
            "id": img.id,
            "image": request.build_absolute_uri(img.image.url) if img.image else None,
        }
        for img in account.images.all()
    ]
    return {
        "id": account.id,
        "title": account.title,
        "game": account.game.name if account.game else None,
        "game_rank": account.game_rank.name if account.game_rank else None,
        "price": float(account.price),
        "description": account.description,
        "accept_offers": account.accept_offers,
        "listings": [_listing_payload(item) for item in account.listings.all()],
        "images": images,
    }


def _load_account(account_id: int) -> Account:
    return (
        Account.objects.filter(pk=account_id)
        .select_related("game", "game_rank")
        .prefetch_related("listings__listing", "listings__choices", "images")
        .get()
    )


@router.get("/mine/", response=list[AccountSchema])
def list_my_accounts(request):
    accounts = (
        Account.objects.filter(user=request.user)
        .select_related("game", "game_rank")
        .prefetch_related("listings__listing", "listings__choices", "images")
        .order_by("-id")
    )
    return [_account_payload(request, account) for account in accounts]


@router.post("/", response=AccountSchema)
def create_account(  # noqa: PLR0913, PLR0917
    request,
    game: int = Form(...),
    game_rank: str = Form(""),
    title: str = Form(""),
    price: str = Form(...),
    description: str = Form(""),
    accept_offers: bool = Form(True),  # noqa: FBT001, FBT003
    details: str = Form("[]"),
):
    try:
        game_obj = Game.objects.get(pk=game)
    except Game.DoesNotExist as exc:
        raise _fail(404, "Game not found.") from exc

    try:
        amount = Decimal(price)
    except InvalidOperation as exc:
        raise _fail(422, "Price must be a number.") from exc
    if amount <= 0:
        raise _fail(422, "Price must be greater than zero.")

    rank_obj = None
    rank_name = game_rank.strip()
    if rank_name:
        rank_obj = game_obj.ranks.filter(name=rank_name).first()
        if rank_obj is None:
            raise _fail(422, f"Rank '{rank_name}' does not belong to {game_obj.name}.")

    headline = title.strip() or rank_name or game_obj.name

    account = Account.objects.create(
        user=request.user,
        title=headline[:100],
        game=game_obj,
        game_rank=rank_obj,
        price=amount,
        description=description,
        accept_offers=accept_offers,
    )

    try:
        _attach_details(account, game_obj, _parse_details(details))
        _attach_images(account, request.FILES.getlist("images")[:MAX_IMAGES])
    except HttpError:
        account.delete()
        raise

    return _account_payload(request, _load_account(account.pk))


def _attach_details(account: Account, game_obj: Game, entries: list[dict]) -> None:
    applicable_ids = set(game_obj.listings.values_list("id", flat=True)) | set(
        Listing.objects.filter(game__isnull=True).values_list("id", flat=True),
    )
    for entry in entries:
        if not isinstance(entry, dict) or "listing" not in entry:
            raise _fail(422, "Each detail needs a 'listing' id.")
        try:
            listing_id = int(entry["listing"])
        except (TypeError, ValueError) as exc:
            raise _fail(422, "Each detail needs a numeric 'listing' id.") from exc
        if listing_id not in applicable_ids:
            raise _fail(422, f"Listing {listing_id} does not apply to {game_obj.name}.")
        listing = Listing.objects.prefetch_related("choices").get(pk=listing_id)
        value = str(entry.get("value", "") or "")[:255]
        item = account.listings.create(
            listing=listing,
            value="" if listing.is_choice() else value,
        )
        if listing.is_choice():
            if not value:
                raise _fail(422, f"Listing '{listing.title}' needs a choice value.")
            choice = listing.choices.filter(choice_value=value).first()
            if choice is None:
                message = f"'{value}' is not a valid choice for '{listing.title}'."
                raise _fail(422, message)
            item.choices.add(choice)


def _attach_images(account: Account, uploads: list) -> None:
    for upload in uploads:
        if not (upload.content_type or "").startswith("image/"):
            raise _fail(422, f"File '{upload.name}' is not an image.")
        account.images.create(image=upload)
