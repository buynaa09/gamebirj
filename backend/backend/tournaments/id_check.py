"""Leader game-account verification via a third-party ID checker.

GET ``{base}/api/{code}?id=...&zone=...`` returns the in-game nickname
when the account exists. Only games with a configured ``Game.id_check_slug``
are verifiable; anything else raises :class:`IdCheckUnsupportedError`.

Transport problems (timeouts, blocks, bad payloads) raise
:class:`IdCheckTransportError` so callers can fail open and log. A definitive
"not found" answer raises :class:`IdCheckNotFoundError` and must fail closed.
"""

from __future__ import annotations

import http.client
import json
import logging
import ssl
import time
import urllib.parse
from dataclasses import dataclass

logger = logging.getLogger(__name__)

ID_CHECK_BASE_URL = "https://goxgame-validator-7zk6.vercel.app"
ID_CHECK_TIMEOUT = 10.0
ID_CHECK_CACHE_TTL = 300.0
# The provider answers "not found" as HTTP 500 + {"status": false}.
ID_CHECK_NOT_FOUND_STATUS = 500

# Per-game checker codes and whether a server/zone ID is required.
ID_CHECK_GAMES: dict[str, dict[str, object]] = {
    "mobile-legends": {"code": "ml", "needs_server": True},
}


class IdCheckError(Exception):
    """Base class for ID checker failures."""


class IdCheckUnsupportedError(IdCheckError):
    """The game has no ID checker mapping."""


class IdCheckNotFoundError(IdCheckError):
    """The checker answered definitively: account does not exist."""


class IdCheckTransportError(IdCheckError):
    """Network error, block page, or unexpected payload."""


@dataclass(frozen=True)
class IdCheckAccount:
    nickname: str
    region: str


_cache: dict[tuple[str, str, str], tuple[float, IdCheckAccount]] = {}


def _get_json(url: str) -> tuple[int, object]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        msg = f"Refusing non-HTTPS ID checker URL: {url}"
        raise IdCheckTransportError(msg)
    context = ssl.create_default_context()
    conn = http.client.HTTPSConnection(
        parsed.hostname,
        parsed.port or 443,
        timeout=ID_CHECK_TIMEOUT,
        context=context,
    )
    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    try:
        conn.request(
            "GET",
            path,
            headers={"User-Agent": "GameBirj/1.0"},
        )
        response = conn.getresponse()
        raw = response.read()
        status = response.status
    except (OSError, http.client.HTTPException) as exc:
        msg = f"ID checker request failed: {exc}"
        raise IdCheckTransportError(msg) from exc
    finally:
        conn.close()
    try:
        return status, json.loads(raw)
    except ValueError as exc:
        msg = "ID checker returned invalid JSON"
        raise IdCheckTransportError(msg) from exc


def check_game_account(slug: str, user_id: str, server_id: str = "") -> IdCheckAccount:
    """Verify a game account, returning its nickname and region."""
    game = ID_CHECK_GAMES.get(slug)
    if game is None:
        msg = f"ID check is not supported for '{slug}'"
        raise IdCheckUnsupportedError(msg)
    user_id = user_id.strip()
    server_id = server_id.strip()
    if not user_id or (game["needs_server"] and not server_id):
        msg = "User ID and server ID are required"
        raise IdCheckNotFoundError(msg)

    cache_key = (slug, user_id, server_id)
    cached = _cache.get(cache_key)
    if cached and (time.monotonic() - cached[0]) < ID_CHECK_CACHE_TTL:
        return cached[1]

    query = {"id": user_id}
    if game["needs_server"]:
        query["zone"] = server_id
    url = f"{ID_CHECK_BASE_URL}/api/{game['code']}?{urllib.parse.urlencode(query)}"
    try:
        status, payload = _get_json(url)
    except IdCheckTransportError:
        logger.warning("ID check failed for %s (%s)", slug, user_id)
        raise
    if not isinstance(payload, dict) or not payload.get("status"):
        # The provider answers HTTP 500 + {"status": false} for
        # nonexistent accounts; anything else without status is a failure.
        if status == ID_CHECK_NOT_FOUND_STATUS and isinstance(payload, dict):
            msg = "Game account not found"
            raise IdCheckNotFoundError(msg)
        msg = f"ID checker request failed with status {status}"
        raise IdCheckTransportError(msg)
    data = payload.get("data")
    nickname = ""
    region = ""
    if isinstance(data, dict) and data.get("success"):
        nickname = str(data.get("name") or "").strip()
        region = str(data.get("country") or "").strip()
    if not nickname:
        msg = "Game account not found"
        raise IdCheckNotFoundError(msg)
    account = IdCheckAccount(nickname=nickname, region=region)
    _cache[cache_key] = (time.monotonic(), account)
    return account
