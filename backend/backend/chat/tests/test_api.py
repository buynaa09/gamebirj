from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.urls import reverse

from backend.chat import services
from backend.chat.models import Conversation
from backend.chat.models import ConversationParticipant
from backend.chat.models import Message
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PAGE_SIZE = 30
TOTAL_MESSAGES = 35
EXPECTED_UNREAD = 2


def _create_url() -> str:
    return reverse("api:create_conversation")


def _list_url() -> str:
    return reverse("api:list_conversations")


def _post_json(client: Client, url: str, payload: dict):
    return client.post(url, data=payload, content_type="application/json")


# --- Conversation creation -------------------------------------------------


def test_create_conversation(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"user_id": bob.pk})

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["other_user"]["id"] == bob.pk
    assert body["other_user"]["username"] == bob.username
    assert "email" not in body["other_user"]
    assert body["account_id"] is None


def test_create_conversation_reuses_existing(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    client.force_login(alice)

    first = _post_json(client, _create_url(), {"user_id": bob.pk}).json()
    second = _post_json(client, _create_url(), {"user_id": bob.pk}).json()

    assert first["id"] == second["id"]


def test_conversation_order_independent(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    client.force_login(alice)
    as_alice = _post_json(client, _create_url(), {"user_id": bob.pk}).json()

    client.force_login(bob)
    as_bob = _post_json(client, _create_url(), {"user_id": alice.pk}).json()

    assert as_alice["id"] == as_bob["id"]
    assert as_bob["other_user"]["id"] == alice.pk


def test_create_conversation_self_chat_rejected(client: Client):
    alice = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"user_id": alice.pk})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_conversation_unknown_user(client: Client):
    alice = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"user_id": 999999})

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_conversation_requires_login(client: Client):
    bob = UserFactory.create()

    response = _post_json(client, _create_url(), {"user_id": bob.pk})

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_conversation_exactly_two_participants():
    alice = UserFactory.create()
    bob = UserFactory.create()
    carol = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)

    assert conversation.participants.count() == services.MAX_PARTICIPANTS

    # A third participant violates the private-chat invariant.
    ConversationParticipant.objects.create(conversation=conversation, user=carol)
    with pytest.raises(ValidationError):
        services.validate_participant_limit(conversation)


def test_duplicate_participant_rejected():
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)

    with pytest.raises(IntegrityError):
        ConversationParticipant.objects.create(conversation=conversation, user=alice)


def test_duplicate_conversation_rejected_at_db():
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)

    with pytest.raises(IntegrityError):
        Conversation.objects.create(
            user_low=conversation.user_low,
            user_high=conversation.user_high,
            pair_key=conversation.pair_key,
        )


# --- Conversation access control -------------------------------------------


def test_non_participant_cannot_access_conversation(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    carol = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(carol)

    detail = client.get(
        reverse("api:get_conversation", kwargs={"conversation_id": conversation.pk}),
    )
    assert detail.status_code == HTTPStatus.NOT_FOUND

    messages = client.get(
        reverse("api:list_messages", kwargs={"conversation_id": conversation.pk}),
    )
    assert messages.status_code == HTTPStatus.NOT_FOUND

    send = _post_json(
        client,
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        {"content": "Hello"},
    )
    assert send.status_code == HTTPStatus.NOT_FOUND

    read = client.post(
        reverse("api:mark_read", kwargs={"conversation_id": conversation.pk}),
    )
    assert read.status_code == HTTPStatus.NOT_FOUND


def test_list_conversations_only_own(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    carol = UserFactory.create()
    services.get_or_create_private_conversation(alice, bob)
    client.force_login(carol)

    response = client.get(_list_url())

    assert response.status_code == HTTPStatus.OK
    assert response.json() == []


def test_get_conversation_detail(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = client.get(
        reverse("api:get_conversation", kwargs={"conversation_id": conversation.pk}),
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["id"] == conversation.pk
    assert body["other_user"]["id"] == bob.pk


# --- Messages ---------------------------------------------------------------


def test_send_message(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = _post_json(
        client,
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        {"content": "Hello Bob"},
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["content"] == "Hello Bob"
    assert body["sender"]["id"] == alice.pk
    assert body["is_read"] is False
    assert Message.objects.filter(conversation=conversation).count() == 1


def test_send_empty_message_rejected(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = _post_json(
        client,
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        {"content": "   "},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_send_too_long_message_rejected(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = _post_json(
        client,
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        {"content": "x" * (services.MAX_MESSAGE_LENGTH + 1)},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_message_history_pagination(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    for i in range(TOTAL_MESSAGES):
        services.send_message(conversation, alice, f"msg {i}")
    client.force_login(bob)

    url = reverse("api:list_messages", kwargs={"conversation_id": conversation.pk})
    first = client.get(url, {"page": 1, "page_size": PAGE_SIZE}).json()
    second = client.get(url, {"page": 2, "page_size": PAGE_SIZE}).json()

    assert first["total"] == TOTAL_MESSAGES
    assert len(first["items"]) == PAGE_SIZE
    assert len(second["items"]) == TOTAL_MESSAGES - PAGE_SIZE
    assert first["items"][0]["content"] == "msg 0"
    assert second["items"][0]["content"] == f"msg {PAGE_SIZE}"


def test_unread_count_and_mark_read(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    services.send_message(conversation, alice, "one")
    services.send_message(conversation, alice, "two")

    client.force_login(bob)
    listing = client.get(_list_url()).json()
    assert listing[0]["unread_count"] == EXPECTED_UNREAD
    assert listing[0]["last_message"] == "two"

    read = client.post(
        reverse("api:mark_read", kwargs={"conversation_id": conversation.pk}),
    )
    assert read.status_code == HTTPStatus.OK
    assert read.json() == {"read": EXPECTED_UNREAD}

    listing = client.get(_list_url()).json()
    assert listing[0]["unread_count"] == 0

    # Own messages never count as unread.
    client.force_login(alice)
    listing = client.get(_list_url()).json()
    assert listing[0]["unread_count"] == 0


def test_conversations_ordered_by_activity(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    carol = UserFactory.create()
    first, _ = services.get_or_create_private_conversation(alice, bob)
    second, _ = services.get_or_create_private_conversation(alice, carol)
    services.send_message(first, bob, "newer")
    client.force_login(alice)

    listing = client.get(_list_url()).json()

    assert [item["conversation_id"] for item in listing] == [first.pk, second.pk]
