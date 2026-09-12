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
from backend.chat.api.schema import CreateOfferRequest
from backend.chat.api.schema import MarkReadResponse
from backend.chat.api.schema import MessageSchema
from backend.chat.api.schema import OfferSchema
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


def _offer_payload(offer) -> dict:
    return {
        "id": offer.id,
        "conversation_id": offer.conversation_id,
        "sender": _user_summary(offer.sender),
        "amount": float(offer.amount),
        "status": offer.status,
        "expires_at": offer.expires_at,
        "decided_at": offer.decided_at,
        "created_at": offer.created_at,
    }


def _message_payload(message: Message) -> dict:
    offer = getattr(message, "offer", None)
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender": _user_summary(message.sender),
        "content": message.content,
        "created_at": message.created_at,
        "is_read": message.is_read,
        "offer": _offer_payload(offer) if offer is not None else None,
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
        "agreed_price": (
            float(conversation.agreed_price)
            if conversation.agreed_price is not None
            else None
        ),
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
    offer = getattr(message, "offer", None)
    offer_event = None
    if offer is not None:
        payload = _offer_payload(offer)
        payload["expires_at"] = offer.expires_at.isoformat()
        if offer.decided_at is not None:
            payload["decided_at"] = offer.decided_at.isoformat()
        payload["created_at"] = offer.created_at.isoformat()
        offer_event = payload
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
            "offer": offer_event,
        },
    )


def _broadcast_offer_updated(offer) -> None:
    payload = _offer_payload(offer)
    payload["expires_at"] = offer.expires_at.isoformat()
    if offer.decided_at is not None:
        payload["decided_at"] = offer.decided_at.isoformat()
    payload["created_at"] = offer.created_at.isoformat()
    offer.conversation.refresh_from_db(fields=["agreed_price"])
    agreed = offer.conversation.agreed_price
    _broadcast(
        f"chat_{offer.conversation_id}",
        {
            "type": "offer.updated",
            "offer": payload,
            "agreed_price": float(agreed) if agreed is not None else None,
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
                "agreed_price": (
                    float(conversation.agreed_price)
                    if conversation.agreed_price is not None
                    else None
                ),
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


@router.post(
    "/conversations/{conversation_id}/offers/",
    response=MessageSchema,
    description="Make a price offer on the conversation's listing (48h to decide).",
)
def create_offer(request, conversation_id: int, data: CreateOfferRequest):
    try:
        conversation = services.get_participant_conversation(
            conversation_id,
            request.user,
        )
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    try:
        offer = services.create_offer(conversation, request.user, data.amount)
    except services.OfferError as exc:
        raise _fail(422, str(exc)) from exc
    message = offer.message
    message.sender = request.user
    message.offer = offer
    _broadcast_message_created(message)
    return _message_payload(message)


def _decide_offer(request, offer_id: int, action: str):
    try:
        offer = services.get_participant_offer(offer_id, request.user)
    except services.NotParticipantError as exc:
        raise _fail(404, str(exc)) from exc
    try:
        offer = services.decide_offer(offer, request.user, action)
    except services.OfferError as exc:
        raise _fail(422, str(exc)) from exc
    _broadcast_offer_updated(offer)
    return _offer_payload(offer)


@router.post(
    "/offers/{offer_id}/accept/",
    response=OfferSchema,
    description="Accept a pending offer (other participant only).",
)
def accept_offer(request, offer_id: int):
    return _decide_offer(request, offer_id, "accept")


@router.post(
    "/offers/{offer_id}/decline/",
    response=OfferSchema,
    description="Decline a pending offer (other participant only).",
)
def decline_offer(request, offer_id: int):
    return _decide_offer(request, offer_id, "decline")


@router.post(
    "/offers/{offer_id}/cancel/",
    response=OfferSchema,
    description="Cancel your own pending offer.",
)
def cancel_offer(request, offer_id: int):
    return _decide_offer(request, offer_id, "cancel")
