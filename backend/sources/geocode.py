# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Open-Meteo geocoding: place name to coordinates. Only the typed text is sent upstream."""
import requests

from backend.sources import NoDataError, UpstreamError

API_URL = "https://geocoding-api.open-meteo.com/v1/search"


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
