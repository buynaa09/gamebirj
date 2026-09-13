from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse

from backend.accounts.models import Account
from backend.accounts.services import _notify_seller_of_sale
from backend.accounts.services import buy_account
from backend.chat.models import Conversation
from backend.chat.models import Message
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

PRICE = 100


def _sold_listing():
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon account", price=PRICE)
    order = buy_account(account.pk, buyer)
    return (seller, buyer, account, order)


def test_notify_posts_sale_alert_to_thread():
    seller, buyer, account, order = _sold_listing()

    _notify_seller_of_sale(order.pk)

    conversation = Conversation.objects.get(account=account)
    assert conversation.get_other_user_id(seller.pk) == buyer.pk
    message = Message.objects.get(conversation=conversation)
    assert message.sender_id == buyer.pk
    assert "Dragon account" in message.content
    assert str(PRICE) in message.content
    assert message.is_read is False


def test_notify_never_raises():
    _, _, _, order = _sold_listing()

    # Missing order must not raise (best-effort hook).
    _notify_seller_of_sale(999999)
    _notify_seller_of_sale(order.pk)


@pytest.mark.django_db(transaction=True)
def test_buy_notifies_seller_once_end_to_end(client: Client):
    seller = UserFactory.create()
    buyer = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon account", price=PRICE)
    client.force_login(buyer)

    buy_url = reverse("api:buy_listing", kwargs={"account_id": account.pk})
    assert client.post(buy_url).status_code == HTTPStatus.OK
    # Winner retry must not duplicate the alert.
    assert client.post(buy_url).status_code == HTTPStatus.OK

    conversation = Conversation.objects.get(account=account)
    messages = Message.objects.filter(conversation=conversation)
    assert messages.count() == 1
    assert "Dragon account" in messages[0].content

    # The seller sees the alert as an unread thread.
    client.force_login(seller)
    threads = client.get(reverse("api:list_conversations")).json()
    assert len(threads) == 1
    assert threads[0]["unread_count"] == 1
    assert threads[0]["account_id"] == account.pk


@pytest.mark.django_db(transaction=True)
def test_failed_buy_sends_no_alert(client: Client):
    seller = UserFactory.create()
    first = UserFactory.create()
    second = UserFactory.create()
    account = Account.objects.create(user=seller, title="Dragon account", price=PRICE)
    buy_url = reverse("api:buy_listing", kwargs={"account_id": account.pk})

    client.force_login(first)
    assert client.post(buy_url).status_code == HTTPStatus.OK

    client.force_login(second)
    assert client.post(buy_url).status_code == HTTPStatus.CONFLICT

    assert Message.objects.count() == 1
