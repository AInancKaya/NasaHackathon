# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Place names. Search: Open-Meteo geocoding (name to coordinates; only the typed text is sent).
Reverse: OpenStreetMap Nominatim (coordinates to city and country; only the clicked point is sent,
under a generic app User-Agent as Nominatim's usage policy asks)."""
from functools import lru_cache

import requests

from backend.sources import NoDataError, UpstreamError

API_URL = "https://geocoding-api.open-meteo.com/v1/search"
REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "TerraVestige/0.1 (education project, NASA Space Apps 2026)"


def search(query: str, count: int = 5, timeout: int = 15) -> list[dict]:
    """Return up to `count` places {name, country, admin1, lat, lon}, best match first."""
    try:
        resp = requests.get(API_URL, params={"name": query, "count": count, "language": "en", "format": "json"},
                            timeout=timeout)
        if resp.status_code != 200:
            raise UpstreamError(f"Open-Meteo geocoding HTTP {resp.status_code}: {resp.text[:200]}")
        results = resp.json().get("results") or []
        places = [{"name": r["name"], "country": r.get("country"), "admin1": r.get("admin1"),
                   "lat": float(r["latitude"]), "lon": float(r["longitude"])} for r in results]
    except (requests.RequestException, KeyError, ValueError, TypeError) as e:
        raise UpstreamError(f"Open-Meteo geocoding request failed: {e}") from e
    if not places:
        raise NoDataError(f"No place found for '{query}'. Try another spelling.")
    return places


@lru_cache(maxsize=2048)
def _reverse(lat: float, lon: float, timeout: int) -> dict:
    try:
        resp = requests.get(REVERSE_URL, params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10,
                                                 "accept-language": "en"},
                            headers={"User-Agent": USER_AGENT}, timeout=timeout)
        if resp.status_code != 200:
            raise UpstreamError(f"Nominatim HTTP {resp.status_code}: {resp.text[:200]}")
        body = resp.json()
    except (requests.RequestException, ValueError) as e:
        raise UpstreamError(f"Nominatim request failed: {e}") from e
    a = body.get("address") or {}
    name = next((a[k] for k in ("city", "town", "village", "municipality", "county", "region", "state")
                 if a.get(k)), None)
    country = a.get("country")
    if body.get("error") or not (name or country):
        raise NoDataError("No named place here (open ocean or an unmapped area).")
    admin1 = a.get("state") or a.get("province")
    return {"name": name, "country": country, "admin1": admin1 if admin1 != name else None,
            "lat": lat, "lon": lon}


def reverse(lat: float, lon: float, timeout: int = 15) -> dict:
    """Nearest named place {name, country, admin1, lat, lon} for a point; cached per 0.01 degree."""
    return dict(_reverse(round(lat, 2), round(lon, 2), timeout))
