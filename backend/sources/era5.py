# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Open-Meteo archive (Copernicus ERA5): daily values aggregated to complete calendar months."""
import pandas as pd
import requests

from backend.cache import cached_series
from backend.sources import NoDataError, UpstreamError

API_URL = "https://archive-api.open-meteo.com/v1/archive"


def fetch_monthly(lat: float, lon: float, start_year: int, end_year: int,
                  daily_var: str, timeout: int = 60) -> tuple[pd.Series, str]:
    """Return (monthly mean of the daily variable, fetched_at). Incomplete months are dropped."""
    def fetch() -> pd.Series:
        try:
            resp = requests.get(API_URL, params={
                "latitude": lat, "longitude": lon,
                "start_date": f"{start_year}-01-01", "end_date": f"{end_year}-12-31",
                "daily": daily_var, "timezone": "UTC", "wind_speed_unit": "ms",
            }, timeout=timeout)
            if resp.status_code != 200:
                raise UpstreamError(f"Open-Meteo HTTP {resp.status_code}: {resp.text[:200]}")
            daily = resp.json()["daily"]
            s = pd.Series(daily[daily_var], index=pd.to_datetime(daily["time"]), dtype=float)
        except (requests.RequestException, KeyError, ValueError) as e:
            raise UpstreamError(f"Open-Meteo request failed: {e}") from e
        g = s.resample("MS")
        count = g.count()
        monthly = g.mean()[count.values == count.index.days_in_month]
        if monthly.empty:
            raise NoDataError("Open-Meteo returned no data for this location/period.")
        monthly.name = daily_var
        return monthly

    return cached_series(f"era5_{daily_var}_{lat}_{lon}_{start_year}_{end_year}", fetch)
