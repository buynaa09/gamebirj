"""Business logic for 1-to-1 private chat.

Shared by the REST API and the WebSocket consumer so both transports
behave identically. Raises plain exceptions; callers translate them into
transport-specific errors (Ninja ``HttpError`` / WS error frames).
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.db.models import OuterRef
from django.db.models import Q
from django.db.models import Subquery
from django.utils import timezone

from backend.chat.models import Conversation
from backend.chat.models import ConversationParticipant
from backend.chat.models import Message
from backend.chat.models import pair_key_for

MAX_MESSAGE_LENGTH = 2000
MAX_PAGE_SIZE = 100
MAX_PARTICIPANTS = 2


class ChatError(Exception):
    """Base error for chat business-logic failures."""


class SelfChatError(ChatError):
    """Raised when a user tries to chat with themselves."""


class NotParticipantError(ChatError):
    """Raised when a user acts on a conversation they do not belong to."""


class InvalidMessageError(ChatError):
    """Raised when message content fails validation."""


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
        .select_related("sender")
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
