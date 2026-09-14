"""WebSocket consumer for 1-to-1 private chat.

URL: /ws/chat/{conversation_id}/
Auth: Clerk JWT via `?token=` (or Django session) — see ClerkTokenAuthMiddleware.
"""

from __future__ import annotations

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from backend.chat import services


def _user_summary(user) -> dict:
    return {"id": user.id, "username": user.username, "name": user.name or ""}


class ChatConsumer(AsyncWebsocketConsumer):
    """Private conversation channel — only the two participants join."""

    async def connect(self):
        user = self.scope.get("user")
        if user is None or user.is_anonymous:
            await self.close(code=4401)
            return
        try:
            conversation_id = int(
                self.scope["url_route"]["kwargs"]["conversation_id"],
            )
        except (KeyError, TypeError, ValueError):  # fmt: skip
            await self.close(code=4400)
            return
        try:
            conversation = await database_sync_to_async(
                services.get_participant_conversation,
            )(conversation_id, user)
        except services.NotParticipantError:
            await self.close(code=4403)
            return
        self.conversation_id = conversation.pk
        self.group_name = f"chat_{conversation.pk}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        group = getattr(self, "group_name", None)
        if group:
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        user = self.scope.get("user")
        if user is None or user.is_anonymous:
            await self.close(code=4401)
            return
        try:
            payload = json.loads(text_data or "")
        except (TypeError, ValueError):  # fmt: skip
            await self.send_json({"type": "error", "detail": "Invalid JSON."})
            return
        event_type = payload.get("type", "message")

        if event_type in ("typing.started", "typing.stopped"):
            await self._relay_typing(event_type, user)
        elif event_type == "read":
            await self._handle_read(user)
        elif event_type == "message":
            await self._handle_message(user, payload)
        else:
            await self.send_json({"type": "error", "detail": "Unknown event type."})

    async def _relay_typing(self, event_type: str, user) -> None:
        await self.channel_layer.group_send(
            self.group_name,
            {"type": event_type, "user_id": user.pk},
        )

    async def _handle_read(self, user) -> None:
        try:
            conversation = await database_sync_to_async(
                services.get_participant_conversation,
            )(self.conversation_id, user)
            count = await database_sync_to_async(
                services.mark_conversation_as_read,
            )(conversation, user)
        except services.NotParticipantError:
            await self.close(code=4403)
            return
        await self.channel_layer.group_send(
            self.group_name,
            {"type": "message.read", "user_id": user.pk, "read": count},
        )

    async def _handle_message(self, user, payload: dict) -> None:
        content = payload.get("content", "")
        try:
            conversation = await database_sync_to_async(
                services.get_participant_conversation,
            )(self.conversation_id, user)
            message = await database_sync_to_async(services.send_message)(
                conversation,
                user,
                content,
            )
        except services.InvalidMessageError as exc:
            await self.send_json({"type": "error", "detail": str(exc)})
            return
        except services.NotParticipantError:
            await self.close(code=4403)
            return

        sender_summary = await database_sync_to_async(_user_summary)(user)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "message.created",
                "id": message.pk,
                "conversation_id": conversation.pk,
                "sender": sender_summary,
                "content": message.content,
                "image": None,
                "created_at": message.created_at.isoformat(),
                "is_read": message.is_read,
            },
        )

    async def send_json(self, payload: dict):
        await self.send(text_data=json.dumps(payload))

    async def message_created(self, event: dict):
        await self.send_json(
            {
                "type": "message.created",
                "id": event["id"],
                "conversation_id": event["conversation_id"],
                "sender": event["sender"],
                "content": event["content"],
                "image": event.get("image"),
                "created_at": event["created_at"],
                "is_read": event["is_read"],
                "offer": event.get("offer"),
            },
        )

    async def message_read(self, event: dict):
        await self.send_json(
            {
                "type": "message.read",
                "user_id": event["user_id"],
                "read": event.get("read", 0),
            },
        )

    async def offer_updated(self, event: dict):
        await self.send_json(
            {
                "type": "offer.updated",
                "offer": event["offer"],
                "agreed_price": event.get("agreed_price"),
            },
        )

    async def escrow_updated(self, event: dict):
        await self.send_json(
            {
                "type": "escrow.updated",
                "order": event["order"],
            },
        )

    async def typing_started(self, event: dict):
        await self.send_json({"type": "typing.started", "user_id": event["user_id"]})

    async def typing_stopped(self, event: dict):
        await self.send_json({"type": "typing.stopped", "user_id": event["user_id"]})
