# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Tests for /api/geocode and /api/reverse. The upstream is replaced by artificial responses here only."""
import pytest
import requests
from backend.main import BadRequest, geocode_place, reverse_place
from backend.sources import NoDataError, UpstreamError, geocode


class _Resp:
    def __init__(self, status, body):
        self.status_code, self._body, self.text = status, body, str(body)

    def json(self):
        return self._body


def _patch(monkeypatch, resp=None, exc=None):
    def fake_get(*_a, **_k):
        if exc:
            raise exc
        return resp
    monkeypatch.setattr(geocode.requests, "get", fake_get)


def test_results_are_mapped(monkeypatch):
    _patch(monkeypatch, _Resp(200, {"results": [
        {"name": "Istanbul", "country": "Turkey", "admin1": "Istanbul", "latitude": 41.0, "longitude": 28.9}]}))
    assert geocode_place("Istanbul") == [
        {"name": "Istanbul", "country": "Turkey", "admin1": "Istanbul", "lat": 41.0, "lon": 28.9}]


def test_no_results_raises_not_found(monkeypatch):
    _patch(monkeypatch, _Resp(200, {"generationtime_ms": 1.0}))
    with pytest.raises(NoDataError):
        geocode_place("zzzzqqq")


@pytest.mark.parametrize("resp,exc", [(_Resp(500, "boom"), None), (None, requests.ConnectionError("down"))])
def test_upstream_failure_raises_upstream_error(monkeypatch, resp, exc):
    _patch(monkeypatch, resp, exc)
    with pytest.raises(UpstreamError):
        geocode_place("Istanbul")


def test_blank_query_is_bad_request():
    with pytest.raises(BadRequest):
        geocode_place("   ")


def test_reverse_names_city_and_country(monkeypatch):
    geocode._reverse.cache_clear()
    _patch(monkeypatch, _Resp(200, {"address": {"suburb": "X", "city": "Ankara", "province": "Ankara",
                                                "country": "Turkey"}}))
    assert reverse_place(39.9199, 32.854) == {"name": "Ankara", "country": "Turkey", "admin1": None,
                                              "lat": 39.92, "lon": 32.85}


def test_reverse_open_ocean_is_not_found(monkeypatch):
    geocode._reverse.cache_clear()
    _patch(monkeypatch, _Resp(200, {"error": "Unable to geocode"}))
    with pytest.raises(NoDataError):
        reverse_place(0.0, -30.0)
