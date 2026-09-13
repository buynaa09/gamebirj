from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.urls import reverse
from django.utils import timezone

from backend.accounts.models import Account
from backend.chat import services
from backend.chat.models import Conversation
from backend.chat.models import ConversationParticipant
from backend.chat.models import Message
from backend.chat.models import Offer
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PAGE_SIZE = 30
TOTAL_MESSAGES = 35
EXPECTED_UNREAD = 2
OFFER_AMOUNT = 80

GIF = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00"
    b"\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


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


def test_create_conversation_by_username(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"username": bob.username})

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["other_user"]["id"] == bob.pk

    # Reuses the same thread as the user_id flow.
    again = _post_json(client, _create_url(), {"user_id": bob.pk}).json()
    assert again["id"] == response.json()["id"]


def test_create_conversation_unknown_username(client: Client):
    alice = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"username": "nobody-here"})

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_conversation_unknown_user(client: Client):
    alice = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {"user_id": 999999})

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_create_conversation_missing_identifier(client: Client):
    alice = UserFactory.create()
    client.force_login(alice)

    response = _post_json(client, _create_url(), {})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
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

    send = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "Hello"},
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

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "Hello Bob"},
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["content"] == "Hello Bob"
    assert body["image"] is None
    assert body["sender"]["id"] == alice.pk
    assert body["is_read"] is False
    assert Message.objects.filter(conversation=conversation).count() == 1


def test_send_empty_message_rejected(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "   "},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_send_too_long_message_rejected(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "x" * (services.MAX_MESSAGE_LENGTH + 1)},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def _gif(name="shot.gif"):
    return SimpleUploadedFile(name, GIF, content_type="image/gif")


def test_send_image_only_message(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "", "image": _gif()},
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["content"] == ""
    assert body["image"] is not None
    assert "chat_images" in body["image"]
    message = Message.objects.get(conversation=conversation)
    assert message.image


def test_send_text_with_image(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "Look at this", "image": _gif()},
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["content"] == "Look at this"
    assert response.json()["image"] is not None


def test_send_non_image_rejected(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)
    text_file = SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")

    response = client.post(
        reverse("api:send_message", kwargs={"conversation_id": conversation.pk}),
        data={"content": "", "image": text_file},
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_message_history_includes_image(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    services.send_message(conversation, alice, "", _gif())
    client.force_login(bob)

    body = client.get(
        reverse("api:list_messages", kwargs={"conversation_id": conversation.pk}),
    ).json()

    assert body["total"] == 1
    assert body["items"][0]["image"] is not None
    assert "chat_images" in body["items"][0]["image"]


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


# --- Offers ------------------------------------------------------------------


def _listing_conversation():
    alice = UserFactory.create()
    bob = UserFactory.create()
    account = Account.objects.create(user=bob, title="Dragon account", price=100)
    conversation, _ = services.get_or_create_private_conversation(
        alice,
        bob,
        account=account,
    )
    return (alice, bob, account, conversation)


def _offer_url(conversation_id: int) -> str:
    return reverse("api:create_offer", kwargs={"conversation_id": conversation_id})


def test_create_offer(client: Client):
    alice, _, _, conversation = _listing_conversation()
    client.force_login(alice)

    response = _post_json(client, _offer_url(conversation.pk), {"amount": OFFER_AMOUNT})

    assert response.status_code == HTTPStatus.OK, response.json()
    body = response.json()
    assert body["offer"]["amount"] == OFFER_AMOUNT
    assert body["offer"]["status"] == "pending"
    assert body["offer"]["sender"]["id"] == alice.pk
    assert Offer.objects.filter(conversation=conversation).count() == 1


def test_create_offer_requires_listing_thread(client: Client):
    alice = UserFactory.create()
    bob = UserFactory.create()
    conversation, _ = services.get_or_create_private_conversation(alice, bob)
    client.force_login(alice)

    response = _post_json(client, _offer_url(conversation.pk), {"amount": 10})

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_offer_invalid_amount(client: Client):
    alice, _, _, conversation = _listing_conversation()
    client.force_login(alice)

    for bad in (0, -5, "junk"):
        response = _post_json(client, _offer_url(conversation.pk), {"amount": bad})
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_offer_duplicate_pending(client: Client):
    alice, _, _, conversation = _listing_conversation()
    client.force_login(alice)

    first = _post_json(client, _offer_url(conversation.pk), {"amount": OFFER_AMOUNT})
    assert first.status_code == HTTPStatus.OK
    second = _post_json(client, _offer_url(conversation.pk), {"amount": 70})

    assert second.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_create_offer_non_participant(client: Client):
    _, _, _, conversation = _listing_conversation()
    carol = UserFactory.create()
    client.force_login(carol)

    response = _post_json(client, _offer_url(conversation.pk), {"amount": 10})

    assert response.status_code == HTTPStatus.NOT_FOUND


def test_accept_offer(client: Client):
    alice, bob, account, conversation = _listing_conversation()
    listing_price = account.price
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(bob)

    response = client.post(reverse("api:accept_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["status"] == "accepted"
    offer.refresh_from_db()
    assert offer.decided_by_id == bob.pk
    # Agreed price is private to the conversation; public listing is untouched.
    conversation.refresh_from_db()
    assert conversation.agreed_price == OFFER_AMOUNT
    account.refresh_from_db()
    assert account.price == listing_price


def test_sender_cannot_accept_own_offer(client: Client):
    alice, _, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(alice)

    response = client.post(reverse("api:accept_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_decline_offer(client: Client):
    alice, bob, account, conversation = _listing_conversation()
    original_price = account.price
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(bob)

    response = client.post(reverse("api:decline_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.OK
    assert response.json()["status"] == "declined"
    account.refresh_from_db()
    assert account.price == original_price
    conversation.refresh_from_db()
    assert conversation.agreed_price is None


def test_decide_offer_twice_rejected(client: Client):
    alice, bob, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(bob)
    client.post(reverse("api:accept_offer", kwargs={"offer_id": offer.pk}))

    again = client.post(reverse("api:decline_offer", kwargs={"offer_id": offer.pk}))

    assert again.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_cancel_offer_by_sender(client: Client):
    alice, _, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(alice)

    response = client.post(reverse("api:cancel_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.OK
    assert response.json()["status"] == "cancelled"


def test_cancel_offer_by_other_rejected(client: Client):
    alice, bob, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(bob)

    response = client.post(reverse("api:cancel_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_expired_offer_cannot_be_accepted(client: Client):
    alice, bob, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    Offer.objects.filter(pk=offer.pk).update(
        expires_at=timezone.now() - timezone.timedelta(hours=1),
    )
    client.force_login(bob)

    response = client.post(reverse("api:accept_offer", kwargs={"offer_id": offer.pk}))

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    offer.refresh_from_db()
    assert offer.status == Offer.EXPIRED


def test_agreed_price_visible_to_participants(client: Client):
    alice, bob, _, conversation = _listing_conversation()
    offer = services.create_offer(conversation, alice, OFFER_AMOUNT)
    services.decide_offer(offer, bob, "accept")

    client.force_login(alice)
    detail = client.get(
        reverse("api:get_conversation", kwargs={"conversation_id": conversation.pk}),
    ).json()
    assert detail["agreed_price"] == OFFER_AMOUNT
    listing = client.get(_list_url()).json()
    assert listing[0]["agreed_price"] == OFFER_AMOUNT

    # Outsiders cannot see it: the conversation is invisible to them.
    carol = UserFactory.create()
    client.force_login(carol)
    assert client.get(_list_url()).json() == []


def test_offer_visible_in_history(client: Client):
    alice, bob, _, conversation = _listing_conversation()
    services.create_offer(conversation, alice, OFFER_AMOUNT)
    client.force_login(bob)

    body = client.get(
        reverse("api:list_messages", kwargs={"conversation_id": conversation.pk}),
        {"page": 1, "page_size": 30},
    ).json()

    assert body["items"][0]["offer"]["amount"] == OFFER_AMOUNT
    assert body["items"][0]["offer"]["status"] == "pending"
