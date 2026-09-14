from __future__ import annotations

import time

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.auth.models import AnonymousUser

from backend.chat.clerk_middleware import ClerkTokenAuthMiddleware
from backend.users import clerk_auth
from backend.users.clerk_auth import ClerkAuthError

pytestmark = pytest.mark.django_db(transaction=True)

ISSUER = "https://clerk.test.example"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"


@pytest.fixture
def bearer_token(settings, monkeypatch):
    settings.CLERK_JWKS_URL = JWKS_URL
    settings.CLERK_SECRET_KEY = "sk_test_dummy"  # noqa: S105 # dummy value for tests
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    def _fake_signing_key(jwks_url: str, ttl: int, kid: str):
        if kid != "test-key":
            msg = "Unknown Clerk signing key"
            raise ClerkAuthError(msg)
        return private_key.public_key()

    monkeypatch.setattr(clerk_auth, "_signing_key", _fake_signing_key)
    monkeypatch.setattr(
        clerk_auth,
        "fetch_clerk_profile",
        lambda sub: {"email": "ws.user@example.com", "username": "wsuser", "name": ""},
    )
    now = int(time.time())
    return pyjwt.encode(
        {"sub": "user_ws123", "iss": ISSUER, "exp": now + 300, "iat": now},
        private_pem,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )


async def _run_middleware(query_string: bytes):
    seen = {}

    async def inner(scope, receive, send):
        seen["scope"] = scope

    scope = {"type": "websocket", "query_string": query_string}
    await ClerkTokenAuthMiddleware(inner)(scope, None, None)
    return seen["scope"]


@pytest.mark.asyncio
async def test_token_sets_scope_user(bearer_token):
    scope = await _run_middleware(f"token={bearer_token}".encode())

    assert scope["user"].is_authenticated
    assert scope["user"].username == "wsuser"
    assert scope["user"].clerk_id == "user_ws123"


@pytest.mark.asyncio
async def test_invalid_token_sets_anonymous():
    scope = await _run_middleware(b"token=invalid")

    assert isinstance(scope["user"], AnonymousUser)


@pytest.mark.asyncio
async def test_no_token_keeps_inner_user():
    from asgiref.sync import sync_to_async  # noqa: PLC0415

    from backend.users.tests.factories import UserFactory  # noqa: PLC0415

    user = await sync_to_async(UserFactory.create)()
    seen = {}

    async def inner(scope, receive, send):
        seen["scope"] = scope

    scope = {"type": "websocket", "query_string": b"", "user": user}
    await ClerkTokenAuthMiddleware(inner)(scope, None, None)

    assert seen["scope"]["user"] == user
