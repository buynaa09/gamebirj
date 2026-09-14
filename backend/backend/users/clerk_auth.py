"""Clerk authentication for the django-ninja REST API and Channels websockets.

The SPA sends the Clerk session JWT (``useAuth().getToken()``) as
``Authorization: Bearer <token>`` (REST) or ``?token=<token>`` (websockets,
which cannot set headers). Tokens are RS256-signed by Clerk; the signature
is verified against the instance JWKS, then the ``sub`` claim is mapped to
a local ``User`` — created on first sight, or adopted by verified email for
accounts that predate the Clerk migration.
"""

from __future__ import annotations

import http.client
import json
import logging
import socket
import ssl
import threading
import time
import typing
import urllib.parse
from typing import Any

import jwt
from django.conf import settings
from django.utils.text import slugify
from ninja.security import HttpBearer

from backend.users.models import User

logger = logging.getLogger(__name__)

JWKS_SUFFIX = "/.well-known/jwks.json"
JWKS_TIMEOUT = 10.0
CLERK_API_TIMEOUT = 10.0


class ClerkAuthError(Exception):
    """Raised when a Clerk token cannot be verified or provisioned."""


def _clerk_settings() -> tuple[str, str, str, int]:
    """Return (secret_key, jwks_url, api_base, jwks_cache_ttl)."""
    jwks_url = getattr(settings, "CLERK_JWKS_URL", "")
    if not jwks_url:
        msg = "CLERK_JWKS_URL is not configured"
        raise ClerkAuthError(msg)
    return (
        getattr(settings, "CLERK_SECRET_KEY", ""),
        jwks_url,
        getattr(settings, "CLERK_API_BASE_URL", "https://api.clerk.com/v1").rstrip("/"),
        int(getattr(settings, "CLERK_JWKS_CACHE_TTL", 600)),
    )


def _expected_issuer(jwks_url: str) -> str:
    """Derive the token issuer from the JWKS URL (the Clerk Frontend API URL)."""
    if jwks_url.endswith(JWKS_SUFFIX):
        return jwks_url[: -len(JWKS_SUFFIX)]
    return jwks_url


class _IPv4HTTPSConnection(http.client.HTTPSConnection):
    """HTTPS connection pinned to the host's first IPv4 address.

    Some cloud networks (e.g. Oracle Cloud VCN) drop IPv6 outbound packets,
    so plain ``getaddrinfo`` connections hang on SYN retransmits before
    falling back to IPv4. Dialing a resolved A record directly — while
    keeping TLS hostname verification against the real hostname — avoids
    the stall. Mirrors the ``urllib3 HAS_IPV6=False`` workaround in the
    production settings.
    """

    def connect(self) -> None:
        try:
            infos = socket.getaddrinfo(
                self.host,
                self.port,
                socket.AF_INET,
                socket.SOCK_STREAM,
            )
        except socket.gaierror as exc:
            msg = f"No IPv4 address for {self.host}"
            raise OSError(msg) from exc
        if not infos:
            msg = f"No IPv4 address for {self.host}"
            raise OSError(msg)
        _family, _socktype, _proto, _canon, sockaddr = infos[0]
        timeout = (
            self.timeout if isinstance(self.timeout, (int, float)) else JWKS_TIMEOUT
        )
        self.sock = socket.create_connection(sockaddr, timeout=timeout)
        if self._tunnel_host:
            self._tunnel()
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)


def _https_get_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float,
) -> Any:
    """GET JSON over HTTPS (IPv4-only, full cert verification)."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        msg = f"Refusing non-HTTPS Clerk URL: {url}"
        raise ClerkAuthError(msg)
    context = ssl.create_default_context()
    conn = _IPv4HTTPSConnection(
        parsed.hostname,
        parsed.port or 443,
        timeout=timeout,
        context=context,
    )
    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    try:
        conn.request("GET", path, headers=headers or {})
        response = conn.getresponse()
        body = response.read()
    except (OSError, http.client.HTTPException) as exc:
        msg = f"Clerk request failed: {exc}"
        raise ClerkAuthError(msg) from exc
    finally:
        conn.close()
    if response.status != http.client.OK:
        msg = f"Clerk request failed with status {response.status}"
        raise ClerkAuthError(msg)
    try:
        return json.loads(body)
    except ValueError as exc:
        msg = "Clerk returned invalid JSON"
        raise ClerkAuthError(msg) from exc


_jwks_lock = threading.Lock()
_jwks_cache: dict[str, Any] = {"keys": {}, "fetched_at": 0.0}


def _fetch_jwks(jwks_url: str) -> dict[str, Any]:
    payload = _https_get_json(jwks_url, timeout=JWKS_TIMEOUT)
    keys: dict[str, Any] = {}
    for jwk in payload.get("keys", []) if isinstance(payload, dict) else []:
        kid = jwk.get("kid")
        if kid:
            keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
    with _jwks_lock:
        _jwks_cache["keys"] = keys
        _jwks_cache["fetched_at"] = time.monotonic()
    return keys


def _signing_key(jwks_url: str, ttl: int, kid: str) -> Any:
    with _jwks_lock:
        keys = dict(_jwks_cache["keys"])
        fetched_at = _jwks_cache["fetched_at"]
    fresh = (time.monotonic() - fetched_at) < ttl
    key = keys.get(kid)
    if key is None or not fresh:
        try:
            keys = _fetch_jwks(jwks_url)
        except ClerkAuthError:
            if key is not None:
                # Serve the stale key rather than failing outright.
                logger.warning("Clerk JWKS refresh failed, using cached key")
                return key
            raise
        key = keys.get(kid)
    if key is None:
        msg = "Unknown Clerk signing key"
        raise ClerkAuthError(msg)
    return key


def verify_clerk_token(token: str) -> dict[str, Any]:
    """Verify a Clerk session JWT and return its claims.

    Raises :class:`ClerkAuthError` when Clerk is unconfigured or the token
    is missing, malformed, expired, or fails signature/issuer checks.
    """
    _secret, jwks_url, _api_base, ttl = _clerk_settings()
    if not token:
        msg = "Missing Clerk token"
        raise ClerkAuthError(msg)
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        msg = f"Malformed Clerk token: {exc}"
        raise ClerkAuthError(msg) from exc
    kid = header.get("kid")
    if header.get("alg") != "RS256" or not kid:
        msg = "Unsupported Clerk token algorithm"
        raise ClerkAuthError(msg)
    key = _signing_key(jwks_url, ttl, kid)
    try:
        return jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            issuer=_expected_issuer(jwks_url),
            leeway=30,
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWTError as exc:
        msg = f"Invalid Clerk token: {exc}"
        raise ClerkAuthError(msg) from exc


def fetch_clerk_profile(sub: str) -> dict[str, str]:
    """Fetch display profile for a Clerk user ID via the Backend API.

    Session JWTs only carry ``sub`` by default (email/username need a
    custom token template), so the Backend API is the source of truth for
    provisioning. Requires ``CLERK_SECRET_KEY``.
    """
    secret, _jwks_url, api_base, _ttl = _clerk_settings()
    if not secret:
        msg = "CLERK_SECRET_KEY is not configured"
        raise ClerkAuthError(msg)
    data = _https_get_json(
        f"{api_base}/users/{urllib.parse.quote(sub, safe='')}",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=CLERK_API_TIMEOUT,
    )
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    email = ""
    for entry in emails:
        address = (entry.get("email_address") or "").strip()
        if not address:
            continue
        if entry.get("id") == primary_id:
            email = address
            break
        if not email:
            email = address
    first = (data.get("first_name") or "").strip()
    last = (data.get("last_name") or "").strip()
    return {
        "email": email,
        "username": (data.get("username") or "").strip(),
        "name": f"{first} {last}".strip(),
    }


def _unique_username(base: str) -> str:
    base = slugify(base)[:30] or "user"
    username = base
    suffix = 0
    while User.objects.filter(username__iexact=username).exists():
        suffix += 1
        username = f"{base[:26]}-{suffix}"
    return username


def get_or_create_clerk_user(claims: dict[str, Any]) -> User:
    """Map verified token claims to a local user (creating if needed)."""
    sub = str(claims.get("sub") or "")
    if not sub:
        msg = "Clerk token has no subject"
        raise ClerkAuthError(msg)
    user = User.objects.filter(clerk_id=sub).first()
    if user is not None:
        return user
    try:
        profile = fetch_clerk_profile(sub)
    except ClerkAuthError:
        logger.warning("Clerk profile fetch failed for %s, using claims only", sub)
        profile = {"email": "", "username": "", "name": ""}
    email = profile["email"]
    if email:
        # Adopt a pre-Clerk account with the same verified email so
        # existing sellers keep their listings and history.
        existing = User.objects.filter(
            email__iexact=email,
            clerk_id__isnull=True,
        ).first()
        if existing is not None:
            existing.clerk_id = sub
            if not existing.name and profile["name"]:
                existing.name = profile["name"][:255]
            existing.save(update_fields=["clerk_id", "name"])
            return existing
    username = profile["username"] or (
        email.split("@")[0] if "@" in email else f"user-{sub[:8]}"
    )
    user = User(
        username=_unique_username(username),
        email=email,
        name=profile["name"][:255],
        clerk_id=sub,
    )
    user.set_unusable_password()
    user.save()
    return user


def get_user_from_token(token: str | None) -> User | None:
    """Verify a raw token and return the mapped user, or None."""
    if not token:
        return None
    try:
        return get_or_create_clerk_user(verify_clerk_token(token))
    except ClerkAuthError as exc:
        logger.warning("Clerk authentication failed: %s", exc)
        return None


class ClerkBearer(HttpBearer):
    """django-ninja auth class verifying Clerk session JWTs.

    ``HttpBearer`` performs no CSRF check (unlike ``SessionAuth``), which
    is correct for header-carried JWTs. Sets ``request.user`` as well as
    ``request.auth`` since the codebase reads ``request.user``.
    """

    def authenticate(
        self,
        request: typing.Any,
        token: str,
    ) -> User | None:
        user = get_user_from_token(token)
        if user is not None:
            request.user = user
        return user
