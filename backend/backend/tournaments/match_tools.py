"""MLBB matchTools lobby client (custom rooms / draft links).

POST ``/matchTools/v1/createMatch`` with ``{"name": ...}`` returns a room
(``_id``). GET ``/matchTools/v1/getMatchUrl?_t=...&matchId=...`` returns the
draft deeplink (``s.mobilelegends.com/...``) that drops players straight
into the lobby.

Authentication is an ``acw_tc`` cookie pasted from a browser session — it can
expire at any time. A non-zero ``code`` (or HTTP error) raises
:class:`MatchToolsApiError` so callers can leave rooms pending and log;
network problems raise :class:`MatchToolsTransportError`.
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

MATCH_TOOLS_BASE_HOST = "sg-api.mobilelegends.com"
MATCH_TOOLS_TIMEOUT = 10.0
HTTP_OK = 200


class MatchToolsError(Exception):
    """Base class for matchTools failures."""


class MatchToolsTransportError(MatchToolsError):
    """Network error, block page, or unexpected payload."""


class MatchToolsApiError(MatchToolsError):
    """The API answered with a non-zero code (e.g. expired cookie)."""

    def __init__(self, code: object, message: str) -> None:
        super().__init__(f"matchTools error {code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True)
class MatchRoom:
    match_id: str
    name: str
    status: str


@dataclass(frozen=True)
class MatchLobby:
    url: str
    name: str
    status: str
    is_closed: bool


@dataclass(frozen=True)
class MatchState:
    """Full getMatchUrl payload for an existing room.

    ``url`` may be empty once the lobby is joined (``room``), the game has
    started (``battle``), or it is over (``result``) — only ``create`` state
    guarantees a deeplink. ``battle`` maps the ``battleData`` object, which
    carries ``win_camp`` and ``player_list`` (each with ``camp`` and ``name``)
    once the result is in.
    """

    url: str
    name: str
    status: str
    is_closed: bool
    battle: dict


def _request(
    method: str,
    path: str,
    cookie: str,
    body: str | None = None,
) -> dict:
    context = ssl.create_default_context()
    conn = http.client.HTTPSConnection(
        MATCH_TOOLS_BASE_HOST,
        443,
        timeout=MATCH_TOOLS_TIMEOUT,
        context=context,
    )
    headers = {
        "User-Agent": "GameBirj/1.0",
        "Cookie": f"acw_tc={cookie}" if "=" not in cookie else cookie,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    try:
        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        raw = response.read()
        status = response.status
    except (OSError, http.client.HTTPException) as exc:
        msg = f"matchTools request failed: {exc}"
        raise MatchToolsTransportError(msg) from exc
    finally:
        conn.close()
    if status != HTTP_OK:
        msg = f"matchTools request failed with HTTP status {status}"
        raise MatchToolsTransportError(msg)
    try:
        payload = json.loads(raw)
    except ValueError as exc:
        msg = "matchTools returned invalid JSON"
        raise MatchToolsTransportError(msg) from exc
    if not isinstance(payload, dict):
        msg = "matchTools returned an unexpected payload"
        raise MatchToolsTransportError(msg)
    if payload.get("code") != 0:
        raise MatchToolsApiError(payload.get("code"), str(payload.get("message") or ""))
    data = payload.get("data")
    if not isinstance(data, dict):
        msg = "matchTools returned no data"
        raise MatchToolsTransportError(msg)
    return data


def create_lobby(name: str, cookie: str) -> MatchRoom:
    """Create a custom room, returning its match ID."""
    name = name.strip()
    if not name:
        msg = "Lobby name is required"
        raise ValueError(msg)
    if not cookie.strip():
        msg = "matchTools cookie is not configured"
        code = "no-cookie"
        raise MatchToolsApiError(code, msg)
    data = _request(
        "POST",
        "/matchTools/v1/createMatch",
        cookie,
        body=json.dumps({"name": name}),
    )
    match_id = str(data.get("_id") or "").strip()
    if not match_id:
        msg = "matchTools returned no match ID"
        raise MatchToolsTransportError(msg)
    return MatchRoom(
        match_id=match_id,
        name=str(data.get("name") or name),
        status=str(data.get("status") or ""),
    )


def get_lobby_url(match_id: str, cookie: str) -> MatchLobby:
    """Fetch the draft deeplink for a room."""
    state = get_match_state(match_id, cookie)
    if not state.url:
        msg = "matchTools returned no lobby URL"
        raise MatchToolsTransportError(msg)
    return MatchLobby(
        url=state.url,
        name=state.name,
        status=state.status,
        is_closed=state.is_closed,
    )


def get_match_state(match_id: str, cookie: str) -> MatchState:
    """Fetch the current state of a room (status + result data).

    Unlike :func:`get_lobby_url` this tolerates an empty ``url`` — joined,
    in-progress, and finished rooms report no deeplink.
    """
    match_id = match_id.strip()
    if not match_id:
        msg = "Match ID is required"
        raise ValueError(msg)
    if not cookie.strip():
        msg = "matchTools cookie is not configured"
        code = "no-cookie"
        raise MatchToolsApiError(code, msg)
    query = urllib.parse.urlencode({"_t": int(time.time() * 1000), "matchId": match_id})
    data = _request("GET", f"/matchTools/v1/getMatchUrl?{query}", cookie)
    battle = data.get("battleData")
    return MatchState(
        url=str(data.get("url") or "").strip(),
        name=str(data.get("name") or ""),
        status=str(data.get("status") or ""),
        is_closed=bool(data.get("isClosed", False)),
        battle=battle if isinstance(battle, dict) else {},
    )
