from __future__ import annotations

import http.client

import pytest

from backend.tournaments import match_tools
from backend.tournaments.match_tools import MatchToolsApiError
from backend.tournaments.match_tools import MatchToolsTransportError
from backend.tournaments.match_tools import create_lobby
from backend.tournaments.match_tools import get_lobby_url
from backend.tournaments.match_tools import get_match_state

pytestmark = pytest.mark.django_db


class FakeResponse:
    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self._body = body.encode()

    def read(self) -> bytes:
        return self._body


class FakeConnection:
    response: FakeResponse | None = None
    seen: dict = {}

    def __init__(self, *args, **kwargs) -> None:
        pass

    def request(self, method, path, body=None, headers=None) -> None:
        FakeConnection.seen = {"method": method, "path": path, "body": body}

    def getresponse(self) -> FakeResponse:
        assert FakeConnection.response is not None
        return FakeConnection.response

    def close(self) -> None:
        pass


@pytest.fixture(autouse=True)
def _fake_http(monkeypatch):
    monkeypatch.setattr(http.client, "HTTPSConnection", FakeConnection)
    yield
    FakeConnection.response = None
    FakeConnection.seen = {}


def test_create_lobby_returns_match_id():
    FakeConnection.response = FakeResponse(
        200,
        '{"code":0,"message":"OK",'
        '"data":{"_id":"abc123","name":"QF1","status":"create"}}',
    )

    room = create_lobby("QF1", "cookie-value")

    assert room.match_id == "abc123"
    assert FakeConnection.seen["method"] == "POST"
    assert FakeConnection.seen["path"] == "/matchTools/v1/createMatch"


def test_get_lobby_url_returns_deeplink():
    FakeConnection.response = FakeResponse(
        200,
        '{"code":0,"message":"OK","data":{"url":"https://s.mobilelegends.com/xyz",'
        '"name":"QF1","status":"create","isClosed":false}}',
    )

    lobby = get_lobby_url("abc123", "cookie-value")

    assert lobby.url == "https://s.mobilelegends.com/xyz"
    assert "matchId=abc123" in FakeConnection.seen["path"]


def test_nonzero_code_raises_api_error():
    FakeConnection.response = FakeResponse(200, '{"code":1001,"message":"expired"}')

    with pytest.raises(MatchToolsApiError):
        create_lobby("QF1", "stale-cookie")


def test_http_error_raises_transport_error():
    FakeConnection.response = FakeResponse(403, "blocked")

    with pytest.raises(MatchToolsTransportError):
        get_lobby_url("abc123", "cookie-value")


def test_missing_cookie_raises_api_error():
    with pytest.raises(MatchToolsApiError):
        create_lobby("QF1", "  ")

    assert match_tools.MATCH_TOOLS_BASE_HOST == "sg-api.mobilelegends.com"


def test_get_match_state_result_with_empty_url():
    FakeConnection.response = FakeResponse(
        200,
        '{"code":0,"message":"OK","data":{"url":"","name":"Final",'
        '"status":"result","isClosed":false,"isValidate":true,'
        '"battleData":{"win_camp":1,'
        '"player_list":[{"name":"ProA","camp":1},{"name":"ProB","camp":2}],'
        '"battleidStr":"971523373671974587"}}}',
    )

    state = get_match_state("abc123", "cookie-value")

    assert state.url == ""
    assert state.status == "result"
    assert state.battle["win_camp"] == 1
    assert [p["name"] for p in state.battle["player_list"]] == ["ProA", "ProB"]
    assert "matchId=abc123" in FakeConnection.seen["path"]


def test_get_match_state_battle_without_battle_data():
    FakeConnection.response = FakeResponse(
        200,
        '{"code":0,"message":"OK","data":{"url":"","name":"QF1",'
        '"status":"battle","isClosed":false}}',
    )

    state = get_match_state("abc123", "cookie-value")

    assert state.status == "battle"
    assert state.battle == {}


def test_get_lobby_url_still_requires_url():
    FakeConnection.response = FakeResponse(
        200,
        '{"code":0,"message":"OK","data":{"url":"","name":"QF1",'
        '"status":"room","isClosed":false}}',
    )

    with pytest.raises(MatchToolsTransportError):
        get_lobby_url("abc123", "cookie-value")
