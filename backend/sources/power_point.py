# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""NASA POWER monthly point time series. Real data only; raises on any failure."""
import numpy as np
import pandas as pd
import requests

from backend.cache import cached_series
from backend.sources import NoDataError, UpstreamError

API_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
FILL_VALUE = -999.0


def _parse(values: dict, param: str) -> pd.Series:
    # keys: YYYYMM; month 13 = annual mean -> drop
    items = {k: v for k, v in values.items() if not k.endswith("13")}
    s = pd.Series(items, dtype=float)
    s.index = pd.to_datetime(s.index, format="%Y%m")
    s = s.sort_index().replace(FILL_VALUE, np.nan)
    s.name = param
    return s


def fetch_monthly(lat: float, lon: float, start_year: int, end_year: int,
                  param: str, timeout: int = 60) -> tuple[pd.Series, str]:
    """Return (monthly Series, fetched_at) for one POWER parameter; missing months are NaN."""
    def fetch() -> pd.Series:
        try:
            resp = requests.get(API_URL, params={
                "parameters": param, "community": "AG",
                "latitude": lat, "longitude": lon,
                "start": start_year, "end": end_year, "format": "JSON",
            }, timeout=timeout)
            if resp.status_code != 200:
                raise UpstreamError(f"NASA POWER HTTP {resp.status_code}: {resp.text[:200]}")
            s = _parse(resp.json()["properties"]["parameter"][param], param)
        except (requests.RequestException, KeyError, ValueError) as e:
            raise UpstreamError(f"NASA POWER point request failed: {e}") from e
        if s.dropna().empty:
            raise NoDataError("NASA POWER returned no data for this location/period.")
        return s

    return cached_series(f"power_point_{param}_{lat}_{lon}_{start_year}_{end_year}", fetch)
