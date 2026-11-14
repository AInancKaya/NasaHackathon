# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""NASA POWER MERRA-2 monthly Zarr store on the AWS open bucket: sparse global grid (~2 degrees)."""
import threading

import numpy as np
import xarray as xr

from backend.cache import cached_grid
from backend.sources import UpstreamError

ZARR_URL = "s3://nasa-power/merra2/temporal/power_merra2_monthly_temporal_utc.zarr"
_lock = threading.Lock()  # one S3 read at a time; concurrent requests then hit the cache


def _load(param: str) -> dict:
    try:
        ds = xr.open_zarr(ZARR_URL, storage_options={"anon": True}, consolidated=True)
        da = ds[param].isel(lat=slice(0, None, 4), lon=slice(0, None, 3)).load()
    except Exception as e:  # s3fs/zarr raise many unrelated types
        raise UpstreamError(f"NASA POWER Zarr read failed: {e}") from e
    da = da.dropna("time", how="all")  # the time axis runs to 2029, data stops at 2026-09
    if da.sizes["time"] == 0:
        raise UpstreamError("NASA POWER Zarr returned only empty data.")
    return {
        "values": da.values.astype("float32"),
        "lats": da["lat"].values, "lons": da["lon"].values,
        "dates": da["time"].dt.strftime("%Y-%m").values.astype(str),
    }


def fetch_grid(param: str) -> tuple[dict, str]:
    """Return (dict with values[time,lat,lon], lats, lons, dates 'YYYY-MM'; fetched_at)."""
    with _lock:
        return cached_grid(f"power_grid_{param}", lambda: _load(param))
