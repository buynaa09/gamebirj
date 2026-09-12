from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from ninja import Router
from ninja.errors import HttpError

from backend.accounts.models import Account
from backend.chat import services
from backend.chat.api.schema import ConversationListItem
from backend.chat.api.schema import ConversationSchema
from backend.chat.api.schema import CreateConversationRequest
from backend.chat.api.schema import MarkReadResponse
from backend.chat.api.schema import MessageSchema
from backend.chat.api.schema import PaginatedMessages
from backend.chat.api.schema import SendMessageRequest

if TYPE_CHECKING:
    from backend.chat.models import Message

router = Router(tags=["chat"])
logger = logging.getLogger(__name__)


def _fail(status: int, message: str) -> HttpError:
    return HttpError(status, message)


def _user_summary(user) -> dict:
    return {"id": user.id, "username": user.username, "name": user.name or ""}


def _message_payload(message: Message) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": _user_summary(message.sender),
        "content": message.content,
        "created_at": message.created_at,
        "is_read": message.is_read,
    }


def _conversation_payload(conversation, user) -> dict:
    other = (
        conversation.user_high
        if conversation.user_low_id == user.pk
        else conversation.user_low
    )
    return {
        "id": conversation.id,
        "other_user": _user_summary(other),
        "account_id": conversation.account_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }


def _broadcast(group: str, event: dict) -> None:
    """Best-effort realtime fan-out; REST stays functional if Redis is down."""
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(group, event)
    except Exception:
        logger.exception("Chat broadcast to %s failed", group)


def _broadcast_message_created(message: Message) -> None:
    sender = message.sender
    _broadcast(
        f"chat_{message.conversation_id}",
        {
            "type": "message.created",
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender": _user_summary(sender),
            "content": message.content,
            "created_at": message.created_at.isoformat(),
            "is_read": message.is_read,
        },
    )


@router.post(
    "/conversations/",
    response=ConversationSchema,
    description="Get or create the private 1-to-1 conversation with another user.",
)
def create_conversation(request, data: CreateConversationRequest):
    user_model = get_user_model()
    if data.user_id is not None:
        try:
            other = user_model.objects.get(pk=data.user_id)
        except user_model.DoesNotExist as exc:
            raise _fail(404, "User not found.") from exc
    elif data.username:
        try:
            other = user_model.objects.get(username=data.username)
        except user_model.DoesNotExist as exc:
            raise _fail(404, "User not found.") from exc
    else:
        raise _fail(422, "Provide user_id or username.")
    account = None
    if data.account_id is not None:
        try:
            account = Account.objects.get(pk=data.account_id)
        except Account.DoesNotExist as exc:
            raise _fail(404, "Listing not found.") from exc
    try:
        conversation, _ = services.get_or_create_private_conversation(
            request.user,
            other,
            account=account,
        )
    except services.SelfChatError as exc:
        raise _fail(422, str(exc)) from exc
    conversation = services.get_participant_conversation(
        conversation.pk,
        request.user,
    )
    return _conversation_payload(conversation, request.user)


@router.get(
    "/conversations/",
    response=list[ConversationListItem],
    description="List the authenticated user's conversations by recent activity.",
)
def list_conversations(request):
    items = []
    for conversation in services.get_user_conversations(request.user):
        other = (
            conversation.user_high
            if conversation.user_low_id == request.user.pk
            else conversation.user_low
        )
        items.append(
            {
                "conversation_id": conversation.id,
                "other_user": _user_summary(other),
                "account_id": conversation.account_id,
                "last_message": conversation.last_message_content,
                "last_message_at": conversation.last_message_at,
                "unread_count": conversation.unread_count,
            },
        )
    return items


@router.get(
    "/conversations/{conversation_id}/",
    response=ConversationSchema,
    description="Retrieve a single conversation (participants only).",
)
def get_conversation(request, conversation_id: int):
    try:
        conversation = services.get_participant_conversation(
            conversation_id,
            request.user,
        )
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    return _conversation_payload(conversation, request.user)


@router.get(
    "/conversations/{conversation_id}/messages/",
    response=PaginatedMessages,
    description="Paginated message history, oldest first (participants only).",
)
def list_messages(request, conversation_id: int, page: int = 1, page_size: int = 30):
    try:
        conversation = services.get_participant_conversation(
            conversation_id,
            request.user,
        )
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    items, total = services.get_conversation_messages(conversation, page, page_size)
    size = min(max(page_size, 1), services.MAX_PAGE_SIZE)
    return {
        "items": [_message_payload(message) for message in items],
        "page": max(page, 1),
        "page_size": size,
        "total": total,
    }


@router.post(
    "/conversations/{conversation_id}/messages/",
    response=MessageSchema,
    description="Send a message via REST (fallback; WebSocket is preferred).",
)
def send_message(request, conversation_id: int, data: SendMessageRequest):
    try:
        conversation = services.get_participant_conversation(
            conversation_id,
            request.user,
        )
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    try:
        message = services.send_message(conversation, request.user, data.content)
    except services.InvalidMessageError as exc:
        raise _fail(422, str(exc)) from exc
    message.sender = request.user
    _broadcast_message_created(message)
    return _message_payload(message)


@router.post(
    "/conversations/{conversation_id}/read/",
    response=MarkReadResponse,
    description="Mark the other participant's messages as read.",
)
def mark_read(request, conversation_id: int):
    try:
        conversation = services.get_participant_conversation(
            conversation_id,
            request.user,
        )
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    count = services.mark_conversation_as_read(conversation, request.user)
    if count:
        _broadcast(
            f"chat_{conversation.pk}",
            {"type": "message.read", "user_id": request.user.pk, "read": count},
        )
    return {"read": count}
