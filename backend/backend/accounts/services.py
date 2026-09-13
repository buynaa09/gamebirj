"""Purchase business logic.

The single rule that matters: one listing sells exactly once. Every buy
takes the account row lock inside a transaction, so concurrent buyers are
serialized by PostgreSQL and exactly one of them wins.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from backend.accounts.models import Account
from backend.accounts.models import EscrowTransaction
from backend.chat.models import Offer

if TYPE_CHECKING:
    from decimal import Decimal

OFFER_HOLD_HOURS = 24


class BuyError(Exception):
    """Base error for purchase failures."""


class ListingNotFoundError(BuyError):
    """Raised when the listing does not exist."""


class AlreadySoldError(BuyError):
    """Raised when someone else already bought the listing."""

    def __init__(self, message: str, order_id: int | None = None):
        super().__init__(message)
        self.order_id = order_id


class SelfPurchaseError(BuyError):
    """Raised when the seller tries to buy their own listing."""


def agreed_price_for(account: Account, buyer) -> Decimal | None:
    """Accepted offer amount still inside its 24h hold, if the buyer has one."""
    cutoff = timezone.now() - timedelta(hours=OFFER_HOLD_HOURS)
    offer = (
        Offer.objects.filter(
            conversation__account=account,
            sender=buyer,
            status=Offer.ACCEPTED,
            decided_at__gt=cutoff,
        )
        .order_by("-decided_at")
        .first()
    )
    return offer.amount if offer is not None else None


def buy_account(account_id: int, buyer) -> EscrowTransaction:
    """Buy a listing instantly under simulated escrow.

    Idempotent for the winner (retry returns the same order); losers and
    latecomers get AlreadySoldError.
    """
    with transaction.atomic():
        try:
            account = (
                Account.objects.select_for_update()
                .select_related("user")
                .get(pk=account_id)
            )
        except Account.DoesNotExist as exc:
            msg = "Listing not found."
            raise ListingNotFoundError(msg) from exc
        if account.user_id == buyer.pk:
            msg = "You cannot buy your own listing."
            raise SelfPurchaseError(msg)
        if account.status != Account.AVAILABLE:
            existing = EscrowTransaction.objects.filter(account=account).first()
            if existing is not None and existing.buyer_id == buyer.pk:
                return existing
            msg = "Listing is already sold."
            order_id = existing.pk if existing is not None else None
            raise AlreadySoldError(msg, order_id=order_id)
        amount = agreed_price_for(account, buyer) or account.price
        now = timezone.now()
        account.status = Account.SOLD
        account.buyer = buyer
        account.sold_price = amount
        account.sold_at = now
        account.save(
            update_fields=["status", "buyer", "sold_price", "sold_at"],
        )
        return EscrowTransaction.objects.create(
            account=account,
            buyer=buyer,
            seller=account.user,
            amount=amount,
        )
