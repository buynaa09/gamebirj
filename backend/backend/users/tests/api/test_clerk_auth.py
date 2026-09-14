from __future__ import annotations

import time
from http import HTTPStatus
from typing import TYPE_CHECKING
from typing import Any

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.urls import reverse

from backend.users import clerk_auth
from backend.users.clerk_auth import ClerkAuthError
from backend.users.clerk_auth import get_or_create_clerk_user
from backend.users.clerk_auth import verify_clerk_token
from backend.users.models import User
from backend.users.tests.factories import UserFactory

if TYPE_CHECKING:
    from django.test import Client

pytestmark = pytest.mark.django_db

ISSUER = "https://clerk.test.example"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"


@pytest.fixture
def rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    return private_pem, private_key.public_key()


@pytest.fixture
def clerk_settings(settings):
    settings.CLERK_JWKS_URL = JWKS_URL
    settings.CLERK_SECRET_KEY = "sk_test_dummy"  # noqa: S105 # dummy value for tests
    return settings


def _make_token(
    private_pem: str,
    *,
    sub: str = "user_abc123",
    issuer: str = ISSUER,
    lifetime: int = 300,
    kid: str = "test-key",
) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {"sub": sub, "iss": issuer, "exp": now + lifetime, "iat": now},
        private_pem,
        algorithm="RS256",
        headers={"kid": kid},
    )


@pytest.fixture
def stub_jwks(monkeypatch, rsa_keypair, clerk_settings):
    _private_pem, public_key = rsa_keypair

    def _fake_signing_key(jwks_url: str, ttl: int, kid: str):
        assert jwks_url == JWKS_URL
        if kid != "test-key":
            msg = "Unknown Clerk signing key"
            raise ClerkAuthError(msg)
        return public_key

    monkeypatch.setattr(clerk_auth, "_signing_key", _fake_signing_key)
    return _private_pem


@pytest.fixture
def stub_profile(monkeypatch):
    monkeypatch.setattr(
        clerk_auth,
        "fetch_clerk_profile",
        lambda sub: {
            "email": "clerk.user@example.com",
            "username": "clerkuser",
            "name": "Clerk User",
        },
    )


def test_verify_valid_token(stub_jwks):
    claims = verify_clerk_token(_make_token(stub_jwks))
    assert claims["sub"] == "user_abc123"
    assert claims["iss"] == ISSUER


def test_verify_expired_token(stub_jwks):
    with pytest.raises(ClerkAuthError):
        verify_clerk_token(_make_token(stub_jwks, lifetime=-120))


def test_verify_wrong_issuer(stub_jwks):
    with pytest.raises(ClerkAuthError):
        verify_clerk_token(_make_token(stub_jwks, issuer="https://evil.example"))


def test_verify_unknown_kid(stub_jwks):
    with pytest.raises(ClerkAuthError):
        verify_clerk_token(_make_token(stub_jwks, kid="other-key"))


def test_verify_malformed_token(clerk_settings):
    with pytest.raises(ClerkAuthError):
        verify_clerk_token("not-a-jwt")


def test_verify_unconfigured(settings):
    settings.CLERK_JWKS_URL = ""
    with pytest.raises(ClerkAuthError):
        verify_clerk_token("whatever")


def test_provision_creates_user(stub_jwks, stub_profile):
    user = get_or_create_clerk_user(verify_clerk_token(_make_token(stub_jwks)))

    assert user.pk is not None
    assert user.clerk_id == "user_abc123"
    assert user.username == "clerkuser"
    assert user.email == "clerk.user@example.com"
    assert user.name == "Clerk User"
    assert not user.has_usable_password()


def test_provision_returns_existing_user(stub_jwks, stub_profile):
    first = get_or_create_clerk_user(verify_clerk_token(_make_token(stub_jwks)))
    second = get_or_create_clerk_user(verify_clerk_token(_make_token(stub_jwks)))

    assert first.pk == second.pk
    assert User.objects.filter(clerk_id="user_abc123").count() == 1


def test_provision_adopts_existing_email_account(stub_jwks, stub_profile):
    legacy = UserFactory.create(email="clerk.user@example.com", username="legacyname")

    user = get_or_create_clerk_user(verify_clerk_token(_make_token(stub_jwks)))

    assert user.pk == legacy.pk
    assert user.clerk_id == "user_abc123"
    # Existing handle is kept, not overwritten by the Clerk username.
    assert user.username == "legacyname"


def test_me_with_bearer_token(client: Client, stub_jwks, stub_profile):
    response = client.get(
        reverse("api:retrieve_current_user"),
        HTTP_AUTHORIZATION=f"Bearer {_make_token(stub_jwks)}",
    )

    assert response.status_code == HTTPStatus.OK, response.json()
    assert response.json()["username"] == "clerkuser"
    assert response.json()["email"] == "clerk.user@example.com"


def test_me_with_invalid_bearer_token(client: Client, clerk_settings):
    response = client.get(
        reverse("api:retrieve_current_user"),
        HTTP_AUTHORIZATION="Bearer invalid",
    )

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_me_without_token_still_unauthorized(client: Client):
    response = client.get(reverse("api:retrieve_current_user"))

    assert response.status_code == HTTPStatus.UNAUTHORIZED


def test_me_with_session_still_works(client: Client, stub_jwks):
    user = UserFactory.create()
    client.force_login(user)

    response = client.get(reverse("api:retrieve_current_user"))

    assert response.status_code == HTTPStatus.OK
    assert response.json()["username"] == user.username


def test_bearer_does_not_leak_into_session(client: Client, stub_jwks, stub_profile):
    client.get(
        reverse("api:retrieve_current_user"),
        HTTP_AUTHORIZATION=f"Bearer {_make_token(stub_jwks)}",
    )
    # No session was created by the Bearer request.
    assert "_auth_user_id" not in client.session


def test_username_collision_gets_suffix(stub_jwks, monkeypatch: Any):
    UserFactory.create(username="clerkuser")
    monkeypatch.setattr(
        clerk_auth,
        "fetch_clerk_profile",
        lambda sub: {"email": "other@example.com", "username": "clerkuser", "name": ""},
    )

    user = get_or_create_clerk_user(verify_clerk_token(_make_token(stub_jwks)))

    assert user.username == "clerkuser-1"
