from __future__ import annotations

from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from django.urls import reverse

from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db


def _signup_url() -> str:
    return reverse("api:signup")


def _login_url() -> str:
    return reverse("api:login_view")


def _logout_url() -> str:
    return reverse("api:logout_view")


def test_signup_creates_user_and_logs_in(client: Client):
    response = client.post(
        _signup_url(),
        data={
            "username": "newuser",
            "email": "newuser@example.com",
            "password1": "s3cure-passw0rd!",
            "password2": "s3cure-passw0rd!",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["username"] == "newuser"
    # Session is authenticated afterwards
    me = client.get(reverse("api:retrieve_current_user"))
    assert me.status_code == HTTPStatus.OK
    assert me.json()["username"] == "newuser"


def test_signup_password_mismatch(client: Client):
    response = client.post(
        _signup_url(),
        data={
            "username": "newuser",
            "email": "newuser@example.com",
            "password1": "s3cure-passw0rd!",
            "password2": "different-passw0rd!",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_signup_duplicate_username(client: Client):
    existing = UserFactory.create(username="taken")

    response = client.post(
        _signup_url(),
        data={
            "username": existing.username,
            "email": "other@example.com",
            "password1": "s3cure-passw0rd!",
            "password2": "s3cure-passw0rd!",
        },
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


def test_login_ok(client: Client):
    user = UserFactory.create(username="loginuser")
    user.set_password("s3cure-passw0rd!")
    user.save()

    response = client.post(
        _login_url(),
        data={"username": "loginuser", "password": "s3cure-passw0rd!"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["username"] == "loginuser"


def test_login_bad_credentials(client: Client):
    response = client.post(
        _login_url(),
        data={"username": "nobody", "password": "wrong"},
        content_type="application/json",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_logout_clears_session(client: Client):
    user = UserFactory.create()
    client.force_login(user)

    response = client.post(_logout_url())

    assert response.status_code == HTTPStatus.OK
    me = client.get(reverse("api:retrieve_current_user"))
    assert me.status_code == HTTPStatus.UNAUTHORIZED
