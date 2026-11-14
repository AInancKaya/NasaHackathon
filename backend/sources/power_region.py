# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""NASA POWER monthly regional API: cos(lat)-weighted mean over a box (<= 10 degrees)."""
import numpy as np
import pandas as pd
import requests

from backend.cache import cached_series
from backend.sources import NoDataError, UpstreamError
from backend.sources.power_point import FILL_VALUE

API_URL = "https://power.larc.nasa.gov/api/temporal/monthly/regional"


def fetch_box_monthly(lat: float, lon: float, box: float, start_year: int, end_year: int,
                      param: str, timeout: int = 120) -> tuple[pd.Series, str]:
    """Return (monthly Series, fetched_at): weighted mean over the box centred on lat/lon."""
    half = box / 2
    lat_min, lat_max = max(lat - half, -90.0), min(lat + half, 90.0)
    lon_min, lon_max = max(lon - half, -180.0), min(lon + half, 180.0)

    def fetch() -> pd.Series:
        try:
            resp = requests.get(API_URL, params={
                "parameters": param, "community": "AG",
                "latitude-min": lat_min, "latitude-max": lat_max,
                "longitude-min": lon_min, "longitude-max": lon_max,
                "start": start_year, "end": end_year, "format": "JSON",
            }, timeout=timeout)
            if resp.status_code != 200:
                raise UpstreamError(f"NASA POWER HTTP {resp.status_code}: {resp.text[:200]}")
            features = resp.json()["features"]
            frame = pd.DataFrame([f["properties"]["parameter"][param] for f in features]).T
            lats = np.array([f["geometry"]["coordinates"][1] for f in features])
        except (requests.RequestException, KeyError, ValueError) as e:
            raise UpstreamError(f"NASA POWER regional request failed: {e}") from e
        frame = frame[~frame.index.str.endswith("13")].replace(FILL_VALUE, np.nan)
        if frame.dropna(how="all").empty:
            raise NoDataError("NASA POWER returned no data for this box/period.")
        w = np.cos(np.radians(lats))
        valid = frame.notna().values
        s = pd.Series((frame.fillna(0).values * w).sum(axis=1) / (valid * w).sum(axis=1), index=frame.index)
        s.index = pd.to_datetime(s.index, format="%Y%m")
        s.name = param
        return s.sort_index()

    return cached_series(f"power_region_{param}_{lat_min}_{lat_max}_{lon_min}_{lon_max}_{start_year}_{end_year}", fetch)
