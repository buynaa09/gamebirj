from __future__ import annotations

import pytest
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator

from backend.chat import services
from backend.chat.models import Message
from backend.chat.routing import websocket_urlpatterns
from backend.users.tests.factories import UserFactory

application = URLRouter(websocket_urlpatterns)

pytestmark = pytest.mark.django_db(transaction=True)

CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403


async def _users():
    alice = await sync_to_async(UserFactory.create)()
    bob = await sync_to_async(UserFactory.create)()
    carol = await sync_to_async(UserFactory.create)()
    return (alice, bob, carol)


async def _conversation(alice, bob):
    conversation, _ = await database_sync_to_async(
        services.get_or_create_private_conversation,
    )(alice, bob)
    return conversation


def _communicator(conversation_id: int, user=None) -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        application,
        f"/ws/chat/{conversation_id}/",
    )
    if user is not None:
        communicator.scope["user"] = user
    return communicator


@pytest.mark.asyncio
async def test_participant_can_connect_and_send():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    communicator = _communicator(conversation.pk, alice)
    connected, _ = await communicator.connect()
    assert connected

    await communicator.send_json_to({"type": "message", "content": "Hello Bob"})
    event = await communicator.receive_json_from(timeout=5)

    assert event["type"] == "message.created"
    assert event["conversation_id"] == conversation.pk
    assert event["sender"]["id"] == alice.pk
    assert event["content"] == "Hello Bob"
    assert event["is_read"] is False

    count = await database_sync_to_async(
        Message.objects.filter(conversation=conversation).count,
    )()
    assert count == 1
    await communicator.disconnect()


@pytest.mark.asyncio
async def test_message_broadcast_to_both_participants():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    alice_ws = _communicator(conversation.pk, alice)
    bob_ws = _communicator(conversation.pk, bob)
    assert (await alice_ws.connect())[0]
    assert (await bob_ws.connect())[0]

    await alice_ws.send_json_to({"type": "message", "content": "Hi"})
    alice_event = await alice_ws.receive_json_from(timeout=5)
    bob_event = await bob_ws.receive_json_from(timeout=5)

    assert alice_event["type"] == "message.created"
    assert bob_event["type"] == "message.created"
    assert alice_event["id"] == bob_event["id"]

    await alice_ws.disconnect()
    await bob_ws.disconnect()


@pytest.mark.asyncio
async def test_non_participant_rejected():
    alice, bob, carol = await _users()
    conversation = await _conversation(alice, bob)
    communicator = _communicator(conversation.pk, carol)

    connected, code = await communicator.connect()

    assert not connected
    assert code == CLOSE_FORBIDDEN


@pytest.mark.asyncio
async def test_anonymous_rejected():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    communicator = _communicator(conversation.pk)

    connected, code = await communicator.connect()

    assert not connected
    assert code == CLOSE_UNAUTHORIZED


@pytest.mark.asyncio
async def test_unrelated_users_do_not_receive():
    alice, bob, carol = await _users()
    other, _, _ = await _users()
    conversation = await _conversation(alice, bob)
    other_conversation = await _conversation(carol, other)
    bob_ws = _communicator(conversation.pk, bob)
    carol_ws = _communicator(other_conversation.pk, carol)
    assert (await bob_ws.connect())[0]
    assert (await carol_ws.connect())[0]

    alice_ws = _communicator(conversation.pk, alice)
    assert (await alice_ws.connect())[0]
    await alice_ws.send_json_to({"type": "message", "content": "private"})
    event = await bob_ws.receive_json_from(timeout=5)
    assert event["type"] == "message.created"

    # Carol's socket stays silent: no broadcast leaks across conversations.
    assert await carol_ws.receive_nothing(timeout=1)

    await alice_ws.disconnect()
    await bob_ws.disconnect()
    await carol_ws.disconnect()


@pytest.mark.asyncio
async def test_empty_message_rejected_not_persisted():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    communicator = _communicator(conversation.pk, alice)
    assert (await communicator.connect())[0]

    await communicator.send_json_to({"type": "message", "content": "  "})
    event = await communicator.receive_json_from(timeout=5)

    assert event["type"] == "error"
    count = await database_sync_to_async(
        Message.objects.filter(conversation=conversation).count,
    )()
    assert count == 0
    await communicator.disconnect()


@pytest.mark.asyncio
async def test_typing_events_relayed_not_persisted():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    alice_ws = _communicator(conversation.pk, alice)
    bob_ws = _communicator(conversation.pk, bob)
    assert (await alice_ws.connect())[0]
    assert (await bob_ws.connect())[0]

    await alice_ws.send_json_to({"type": "typing.started"})
    event = await bob_ws.receive_json_from(timeout=5)
    assert event == {"type": "typing.started", "user_id": alice.pk}

    await alice_ws.send_json_to({"type": "typing.stopped"})
    event = await bob_ws.receive_json_from(timeout=5)
    assert event == {"type": "typing.stopped", "user_id": alice.pk}

    count = await database_sync_to_async(
        Message.objects.filter(conversation=conversation).count,
    )()
    assert count == 0
    await alice_ws.disconnect()
    await bob_ws.disconnect()


@pytest.mark.asyncio
async def test_read_event_broadcast():
    alice, bob, _ = await _users()
    conversation = await _conversation(alice, bob)
    await database_sync_to_async(services.send_message)(
        conversation,
        alice,
        "ping",
    )
    alice_ws = _communicator(conversation.pk, alice)
    bob_ws = _communicator(conversation.pk, bob)
    assert (await alice_ws.connect())[0]
    assert (await bob_ws.connect())[0]

    await bob_ws.send_json_to({"type": "read"})
    event = await alice_ws.receive_json_from(timeout=5)

    assert event["type"] == "message.read"
    assert event["user_id"] == bob.pk
    await alice_ws.disconnect()
    await bob_ws.disconnect()
