"""Business logic for 1-to-1 private chat.

Shared by the REST API and the WebSocket consumer so both transports
behave identically. Raises plain exceptions; callers translate them into
transport-specific errors (Ninja ``HttpError`` / WS error frames).
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from decimal import InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.db.models import OuterRef
from django.db.models import Q
from django.db.models import Subquery
from django.utils import timezone

from backend.accounts.models import Account
from backend.chat.models import Conversation
from backend.chat.models import ConversationParticipant
from backend.chat.models import Message
from backend.chat.models import Offer
from backend.chat.models import pair_key_for

MAX_MESSAGE_LENGTH = 2000
MAX_PAGE_SIZE = 100
MAX_PARTICIPANTS = 2
OFFER_TTL_HOURS = 48
OFFER_HOLD_HOURS = 24


class ChatError(Exception):
    """Base error for chat business-logic failures."""


class SelfChatError(ChatError):
    """Raised when a user tries to chat with themselves."""


class NotParticipantError(ChatError):
    """Raised when a user acts on a conversation they do not belong to."""


class InvalidMessageError(ChatError):
    """Raised when message content fails validation."""


class OfferError(ChatError):
    """Raised when an offer fails validation or a decision is forbidden."""


def validate_content(content: str) -> str:
    text = (content or "").strip()
    if not text:
        msg = "Message content cannot be empty."
        raise InvalidMessageError(msg)
    if len(text) > MAX_MESSAGE_LENGTH:
        msg = f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)."
        raise InvalidMessageError(msg)
    return text


def get_or_create_private_conversation(
    user1,
    user2,
    account=None,
) -> tuple[Conversation, bool]:
    """Return the unique 1-to-1 conversation for the two users.

    ``account`` is optional: ``None`` gives the generic DM thread, otherwise
    the thread scoped to that listing. A+B always resolves the same as B+A.
    """
    if user1.pk == user2.pk:
        msg = "You cannot chat with yourself."
        raise SelfChatError(msg)
    low_id = min(user1.pk, user2.pk)
    pair_key = pair_key_for(user1.pk, user2.pk)
    with transaction.atomic():
        lookup = Conversation.objects.select_for_update().filter(
            pair_key=pair_key,
            account=account,
        )
        existing = lookup.first()
        if existing is not None:
            return (existing, False)
        low = user1 if user1.pk == low_id else user2
        high = user2 if user1.pk == low_id else user1
        conversation = Conversation.objects.create(
            account=account,
            user_low=low,
            user_high=high,
            pair_key=pair_key,
        )
        ConversationParticipant.objects.bulk_create(
            [
                ConversationParticipant(conversation=conversation, user=low),
                ConversationParticipant(conversation=conversation, user=high),
            ],
        )
        return (conversation, True)


def get_participant_conversation(conversation_id: int, user) -> Conversation:
    """Return the conversation iff ``user`` is a participant.

    Raises ``Conversation.DoesNotExist`` otherwise, so callers can map it
    to 404 without leaking the conversation's existence (IDOR-safe).
    """
    try:
        return Conversation.objects.select_related(
            "user_low",
            "user_high",
            "account",
        ).get(pk=conversation_id, participants__user=user)
    except Conversation.DoesNotExist:
        msg = "Conversation not found."
        raise NotParticipantError(msg) from None


def is_participant(conversation: Conversation, user) -> bool:
    return user.pk in (conversation.user_low_id, conversation.user_high_id)


def send_message(conversation: Conversation, sender, content: str) -> Message:
    """Validate, persist, and return a new message; bumps activity."""
    text = validate_content(content)
    if not is_participant(conversation, sender):
        msg = "You are not a participant of this conversation."
        raise NotParticipantError(msg)
    with transaction.atomic():
        message = Message.objects.create(
            conversation=conversation,
            sender=sender,
            content=text,
        )
        Conversation.objects.filter(pk=conversation.pk).update(
            updated_at=timezone.now(),
        )
    return message


def mark_conversation_as_read(conversation: Conversation, user) -> int:
    """Mark the other participant's messages as read; returns count."""
    if not is_participant(conversation, user):
        msg = "You are not a participant of this conversation."
        raise NotParticipantError(msg)
    now = timezone.now()
    return (
        Message.objects.filter(conversation=conversation)
        .exclude(sender=user)
        .filter(is_read=False)
        .update(is_read=True, read_at=now)
    )


def get_user_conversations(user):
    """Conversations of ``user`` annotated for list display (no N+1)."""
    latest = Message.objects.filter(conversation=OuterRef("pk")).order_by(
        "-created_at",
        "-id",
    )
    return (
        Conversation.objects.filter(participants__user=user)
        .select_related("user_low", "user_high", "account")
        .annotate(
            last_message_content=Subquery(latest.values("content")[:1]),
            last_message_at=Subquery(latest.values("created_at")[:1]),
            last_message_sender_id=Subquery(latest.values("sender_id")[:1]),
            unread_count=Count(
                "messages",
                filter=Q(messages__is_read=False) & ~Q(messages__sender=user),
            ),
        )
        .order_by("-updated_at", "-id")
        .distinct()
    )


def get_conversation_messages(conversation: Conversation, page: int, page_size: int):
    """Page-based history, oldest-first within the page (chat-UI friendly)."""
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    base = (
        Message.objects.filter(conversation=conversation)
        .select_related("sender", "offer", "offer__sender")
        .order_by("created_at", "id")
    )
    total = base.count()
    offset = (page - 1) * page_size
    return (list(base[offset : offset + page_size]), total)


def validate_participant_limit(conversation: Conversation) -> None:
    """Guard helper: a private conversation must contain exactly 2 users."""
    count = conversation.participants.count()
    if count != MAX_PARTICIPANTS:
        msg = f"Expected {MAX_PARTICIPANTS} participants, found {count}."
        raise ValidationError(msg)


def parse_amount(raw: object) -> Decimal:
    try:
        amount = Decimal(str(raw))
    except (InvalidOperation, ValueError, TypeError) as exc:
        msg = "Offer amount must be a number."
        raise OfferError(msg) from exc
    if amount <= 0:
        msg = "Offer amount must be greater than zero."
        raise OfferError(msg)
    return amount


def refresh_offer_status(offer: Offer) -> Offer:
    """Lazily expire pending offers past their 48h window."""
    if offer.status == Offer.PENDING and timezone.now() > offer.expires_at:
        offer.status = Offer.EXPIRED
        offer.save(update_fields=["status", "updated_at"])
    return offer


def get_participant_offer(offer_id: int, user) -> Offer:
    """Return the offer iff ``user`` is in its conversation (else 404-safe)."""
    try:
        offer = Offer.objects.select_related(
            "conversation",
            "conversation__user_low",
            "conversation__user_high",
            "conversation__account",
            "sender",
        ).get(pk=offer_id, conversation__participants__user=user)
    except Offer.DoesNotExist:
        msg = "Offer not found."
        raise NotParticipantError(msg) from None
    return refresh_offer_status(offer)


def create_offer(conversation: Conversation, sender, amount_raw: object) -> Offer:
    """Create a price offer plus its chat message, atomically."""
    if not is_participant(conversation, sender):
        msg = "You are not a participant of this conversation."
        raise NotParticipantError(msg)
    if conversation.account_id is None:
        msg = "Offers are only available on listing conversations."
        raise OfferError(msg)
    amount = parse_amount(amount_raw)
    if Offer.objects.filter(
        conversation=conversation,
        sender=sender,
        status=Offer.PENDING,
    ).exists():
        msg = "You already have a pending offer in this conversation."
        raise OfferError(msg)
    with transaction.atomic():
        offer = Offer.objects.create(
            conversation=conversation,
            sender=sender,
            amount=amount,
            expires_at=timezone.now() + timedelta(hours=OFFER_TTL_HOURS),
        )
        message = Message.objects.create(
            conversation=conversation,
            sender=sender,
            content=f"Санал: {amount}₮",
            offer=offer,
        )
        # Message is newest-first irrelevant; offer side stays untouched
        # (OneToOne lives on Message).
        Conversation.objects.filter(pk=conversation.pk).update(
            updated_at=timezone.now(),
        )
    offer.message = message  # in-memory only; relation lives on Message
    return offer


def decide_offer(offer: Offer, user, action: str) -> Offer:
    """Accept / decline (other participant) or cancel (sender) a pending offer."""
    offer = refresh_offer_status(offer)
    if not is_participant(offer.conversation, user):
        msg = "You are not a participant of this conversation."
        raise NotParticipantError(msg)
    if offer.status != Offer.PENDING:
        msg = f"Offer is already {offer.status}."
        raise OfferError(msg)
    if action == "cancel":
        if user.pk != offer.sender_id:
            msg = "Only the sender can cancel this offer."
            raise OfferError(msg)
        offer.status = Offer.CANCELLED
    elif action in ("accept", "decline"):
        if user.pk == offer.sender_id:
            msg = "You cannot decide on your own offer."
            raise OfferError(msg)
        offer.status = Offer.ACCEPTED if action == "accept" else Offer.DECLINED
    else:
        msg = f"Unknown offer action: {action}."
        raise OfferError(msg)
    offer.decided_at = timezone.now()
    offer.decided_by = user
    with transaction.atomic():
        offer.save(
            update_fields=["status", "decided_at", "decided_by", "updated_at"],
        )
        if offer.status == Offer.ACCEPTED and offer.conversation.account_id is not None:
            # The agreed price becomes the listing price for everyone.
            Account.objects.filter(pk=offer.conversation.account_id).update(
                price=offer.amount,
            )
    return offer
