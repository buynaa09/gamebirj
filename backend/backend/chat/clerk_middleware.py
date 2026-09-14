"""Channels middleware authenticating websockets via a Clerk JWT.

Browsers cannot set headers on WebSocket handshakes, so the SPA appends
the Clerk session JWT as ``?token=`` (see ``buildChatWsUrl``). When present
the token takes precedence over the session; otherwise the inner
``AuthMiddlewareStack`` result is kept.
"""

from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser

from backend.users.clerk_auth import get_user_from_token


@database_sync_to_async
def _get_user_from_token(token: str):
    return get_user_from_token(token)


class ClerkTokenAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(
            scope.get("query_string", b"").decode("ascii", errors="ignore"),
        )
        tokens = query.get("token", [])
        if tokens:
            user = await _get_user_from_token(tokens[0])
            scope["user"] = user if user is not None else AnonymousUser()
        elif scope.get("user") is None:
            scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)
