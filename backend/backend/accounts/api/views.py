from __future__ import annotations

import json
import logging
from decimal import Decimal
from decimal import InvalidOperation

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Count
from django.db.models import Q
from ninja import Form
from ninja import Router
from ninja.errors import HttpError

from backend.accounts.api.schema import AccountSchema
from backend.accounts.api.schema import AccountUpdateSchema
from backend.accounts.api.schema import EscrowStatusSchema
from backend.accounts.api.schema import OrderSchema
from backend.accounts.api.schema import RentalOrderSchema
from backend.accounts.api.schema import RentRequestSchema
from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.accounts.models import RentalTransaction
from backend.accounts.services import AlreadyRentedError
from backend.accounts.services import AlreadySoldError
from backend.accounts.services import InvalidDurationError
from backend.accounts.services import ListingNotFoundError
from backend.accounts.services import NotBuyerError
from backend.accounts.services import NotRentalError
from backend.accounts.services import OrderNotFoundError
from backend.accounts.services import OrderStateError
from backend.accounts.services import SelfPurchaseError
from backend.accounts.services import SelfRentalError
from backend.accounts.services import buy_account
from backend.accounts.services import release_escrow
from backend.accounts.services import rent_account
from backend.chat.models import Conversation
from backend.games.models import Game
from backend.games.models import Listing
from backend.media import absolute_media_url

router = Router(tags=["accounts"])

logger = logging.getLogger(__name__)

MAX_IMAGES = 15


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


def _my_wishlist_ids(request) -> set[int]:
    user = request.user
    if not user.is_authenticated:
        return set()
    return set(user.wishlist.values_list("account_id", flat=True))


def _account_payload(request, account: Account, wishlist_ids: set[int]) -> dict:
    images = [
        {"id": img.id, "image": absolute_media_url(request, img.image)}
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
        "seller": account.user.username,
        "status": account.status,
        "kind": account.kind,
        "rental_unit": account.rental_unit,
        "sold_price": (
            float(account.sold_price)
            if account.sold_price is not None
            and (
                request.user.pk == account.user_id
                or (
                    account.buyer_id is not None and request.user.pk == account.buyer_id
                )
            )
            else None
        ),
        "created_at": account.created_at.isoformat() if account.created_at else "",
        "wishlisted": account.id in wishlist_ids,
        "wishlist_count": account.wishlist_count,
        "listings": [_listing_payload(item) for item in account.listings.all()],
        "images": images,
    }


def _load_account(account_id: int) -> Account:
    return (
        Account.objects.filter(pk=account_id)
        .select_related("game", "game_rank")
        .prefetch_related("listings__listing", "listings__choices", "images")
        .annotate(wishlist_count=Count("wishlisted_by"))
        .get()
    )


def _base_queryset():
    return (
        Account.objects.select_related("game", "game_rank", "user")
        .prefetch_related(
            "listings__listing",
            "listings__choices",
            "images",
        )
        .annotate(wishlist_count=Count("wishlisted_by"))
    )


@router.get("/", response=list[AccountSchema], auth=None)
def list_accounts(
    request, game: int | None = None, q: str | None = None, kind: str | None = None
):
    accounts = (
        _base_queryset().filter(status=Account.AVAILABLE).order_by("-created_at", "-id")
    )
    if game is not None:
        accounts = accounts.filter(game_id=game)
    if kind in (Account.SALE, Account.RENT):
        accounts = accounts.filter(kind=kind)
    if q:
        accounts = accounts.filter(
            Q(title__icontains=q)
            | Q(description__icontains=q)
            | Q(game__name__icontains=q)
            | Q(game_rank__name__icontains=q),
        )
    wishlist_ids = _my_wishlist_ids(request)
    return [_account_payload(request, account, wishlist_ids) for account in accounts]


@router.get("/mine/", response=list[AccountSchema])
def list_my_accounts(request):
    accounts = _base_queryset().filter(user=request.user).order_by("-created_at", "-id")
    wishlist_ids = _my_wishlist_ids(request)
    return [_account_payload(request, account, wishlist_ids) for account in accounts]


@router.get("/wishlist/", response=list[AccountSchema])
def list_wishlist(request):
    accounts = (
        _base_queryset()
        .filter(wishlisted_by__user=request.user)
        .order_by("-wishlisted_by__created_at", "-id")
    )
    wishlist_ids = _my_wishlist_ids(request)
    return [_account_payload(request, account, wishlist_ids) for account in accounts]


@router.get("/{account_id}/", response=AccountSchema, auth=None)
def retrieve_account(request, account_id: int):
    try:
        account = _base_queryset().get(pk=account_id)
    except Account.DoesNotExist as exc:
        raise _fail(404, "Listing not found.") from exc
    return _account_payload(request, account, _my_wishlist_ids(request))


@router.post("/{account_id}/wishlist/", response=dict)
def add_wishlist(request, account_id: int):
    try:
        account = Account.objects.get(pk=account_id)
    except Account.DoesNotExist as exc:
        raise _fail(404, "Listing not found.") from exc
    request.user.wishlist.get_or_create(account=account)
    return {"wishlisted": True}


@router.delete("/{account_id}/wishlist/", response=dict)
def remove_wishlist(request, account_id: int):
    request.user.wishlist.filter(account_id=account_id).delete()
    return {"wishlisted": False}


def _own_account_or_404(request, account_id: int) -> Account:
    try:
        return Account.objects.select_related("game").get(
            pk=account_id,
            user=request.user,
        )
    except Account.DoesNotExist as exc:
        raise _fail(404, "Listing not found.") from exc


def _parse_price(raw: str) -> Decimal:
    try:
        amount = Decimal(raw)
    except InvalidOperation as exc:
        raise _fail(422, "Price must be a number.") from exc
    if amount <= 0:
        raise _fail(422, "Price must be greater than zero.")
    return amount


def _resolve_rank(game, rank_name: str):
    name = rank_name.strip()
    if not name:
        return None
    rank_obj = game.ranks.filter(name=name).first() if game else None
    if rank_obj is None:
        raise _fail(422, f"Rank '{name}' does not belong to this listing.")
    return rank_obj


@router.patch("/{account_id}/", response=AccountSchema)
def update_account(request, account_id: int, data: AccountUpdateSchema):
    account = _own_account_or_404(request, account_id)

    if data.title is not None:
        headline = data.title.strip()
        if not headline:
            raise _fail(422, "Title cannot be blank.")
        account.title = headline[:100]
    if data.price is not None:
        account.price = _parse_price(data.price)
    if data.description is not None:
        account.description = data.description
    if data.accept_offers is not None:
        account.accept_offers = data.accept_offers
    if data.game_rank is not None:
        account.game_rank = _resolve_rank(account.game, data.game_rank)
    account.save()
    wishlist_ids = _my_wishlist_ids(request)
    return _account_payload(request, _load_account(account.pk), wishlist_ids)


@router.delete("/{account_id}/", response=dict)
def delete_account(request, account_id: int):
    account = _own_account_or_404(request, account_id)
    account.delete()
    return {"deleted": True}


@router.post(
    "/{account_id}/buy/",
    response=OrderSchema,
    description="Buy a listing instantly under simulated escrow.",
)
def buy_listing(request, account_id: int):
    try:
        order = buy_account(account_id, request.user)
    except ListingNotFoundError as exc:
        raise _fail(404, str(exc)) from exc
    except SelfPurchaseError as exc:
        raise _fail(422, str(exc)) from exc
    except AlreadySoldError as exc:
        raise HttpError(409, str(exc)) from exc
    return {
        "order_id": order.pk,
        "account_id": order.account_id,
        "amount": float(order.amount),
        "status": order.status,
        "sold_at": order.created_at.isoformat(),
    }


def _escrow_payload(request, order: EscrowTransaction) -> dict:
    return {
        "order_id": order.pk,
        "account_id": order.account_id,
        "amount": float(order.amount),
        "status": order.status,
        "sold_at": order.created_at.isoformat(),
        "is_buyer": request.user.pk == order.buyer_id,
        "is_seller": request.user.pk == order.seller_id,
    }


def _participant_order_or_404(request, account_id: int) -> EscrowTransaction:
    """Escrow order iff the user is its buyer or seller (else 404, IDOR-safe)."""
    order = (
        EscrowTransaction.objects.select_related("account")
        .filter(account_id=account_id)
        .first()
    )
    if order is None or request.user.pk not in (order.buyer_id, order.seller_id):
        raise _fail(404, "Order not found.")
    return order


def _broadcast_escrow_updated(order: EscrowTransaction) -> None:
    """Notify open chat threads about this listing that escrow moved."""
    try:
        conversation_ids = list(
            Conversation.objects.filter(account_id=order.account_id)
            .filter(participants__user_id=order.buyer_id)
            .filter(participants__user_id=order.seller_id)
            .values_list("id", flat=True)
            .distinct(),
        )
    except Exception:
        logger.exception("Escrow broadcast lookup failed")
        return
    payload = {
        "order_id": order.pk,
        "account_id": order.account_id,
        "amount": float(order.amount),
        "status": order.status,
    }
    try:
        channel_layer = get_channel_layer()
        for conversation_id in conversation_ids:
            async_to_sync(channel_layer.group_send)(
                f"chat_{conversation_id}",
                {"type": "escrow.updated", "order": payload},
            )
    except Exception:
        logger.exception("Escrow broadcast to chat failed")


@router.get(
    "/{account_id}/order/",
    response=EscrowStatusSchema,
    description="Escrow status of a listing (buyer and seller only).",
)
def get_order(request, account_id: int):
    order = _participant_order_or_404(request, account_id)
    return _escrow_payload(request, order)


@router.post(
    "/{account_id}/confirm/",
    response=EscrowStatusSchema,
    description="Buyer confirms the account is correct; held money moves to the seller.",
)
def confirm_receipt(request, account_id: int):
    order = _participant_order_or_404(request, account_id)
    if request.user.pk != order.buyer_id:
        raise _fail(403, "Only the buyer can confirm receipt.")
    try:
        order = release_escrow(account_id, request.user)
    except OrderNotFoundError as exc:
        raise _fail(404, str(exc)) from exc
    except NotBuyerError as exc:
        raise _fail(403, str(exc)) from exc
    except OrderStateError as exc:
        raise _fail(422, str(exc)) from exc
    _broadcast_escrow_updated(order)
    return _escrow_payload(request, order)


def _rental_payload(request, rental: RentalTransaction) -> dict:
    return {
        "order_id": rental.pk,
        "account_id": rental.account_id,
        "unit": rental.unit,
        "duration": rental.duration,
        "unit_price": float(rental.unit_price),
        "total": float(rental.total),
        "status": rental.status,
        "start_at": rental.start_at.isoformat(),
        "end_at": rental.end_at.isoformat(),
        "is_renter": request.user.pk == rental.renter_id,
        "is_owner": request.user.pk == rental.owner_id,
    }


@router.post(
    "/{account_id}/rent/",
    response=RentalOrderSchema,
    description="Rent a rental listing directly under simulated escrow.",
)
def rent_listing(request, account_id: int, data: RentRequestSchema):
    try:
        rental = rent_account(account_id, request.user, data.duration)
    except ListingNotFoundError as exc:
        raise _fail(404, str(exc)) from exc
    except NotRentalError as exc:
        raise _fail(422, str(exc)) from exc
    except SelfRentalError as exc:
        raise _fail(422, str(exc)) from exc
    except InvalidDurationError as exc:
        raise _fail(422, str(exc)) from exc
    except AlreadyRentedError as exc:
        raise HttpError(409, str(exc)) from exc
    return _rental_payload(request, rental)


@router.get(
    "/{account_id}/rental/",
    response=RentalOrderSchema,
    description="Latest rental of a listing (renter and owner only).",
)
def get_rental(request, account_id: int):
    rental = (
        RentalTransaction.objects.filter(account_id=account_id)
        .order_by("-created_at", "-id")
        .first()
    )
    if rental is None or request.user.pk not in (rental.renter_id, rental.owner_id):
        raise _fail(404, "Rental not found.")
    return _rental_payload(request, rental)


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
    kind: str = Form(Account.SALE),
    rental_unit: str = Form(""),
):
    try:
        game_obj = Game.objects.get(pk=game, is_active=True)
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

    kind_value = (kind or Account.SALE).strip().lower()
    if kind_value not in (Account.SALE, Account.RENT):
        raise _fail(422, "Kind must be 'sale' or 'rent'.")
    unit_value = (rental_unit or "").strip().lower() or None
    if kind_value == Account.RENT:
        if unit_value not in (Account.HOUR, Account.DAY, Account.MONTH):
            raise _fail(422, "Rental unit must be 'hour', 'day' or 'month'.")
    else:
        unit_value = None

    account = Account.objects.create(
        user=request.user,
        title=headline[:100],
        game=game_obj,
        game_rank=rank_obj,
        price=amount,
        description=description,
        accept_offers=accept_offers,
        kind=kind_value,
        rental_unit=unit_value,
    )

    try:
        _attach_details(account, game_obj, _parse_details(details))
        _attach_images(account, request.FILES.getlist("images")[:MAX_IMAGES])
    except HttpError:
        account.delete()
        raise

    return _account_payload(
        request,
        _load_account(account.pk),
        _my_wishlist_ids(request),
    )


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
