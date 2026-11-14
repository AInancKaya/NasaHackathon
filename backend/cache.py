# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Disk cache in cache/ (git-ignored). Stores fetched data with its original fetched_at."""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
MAX_AGE_S = 30 * 24 * 3600  # monthly data: refetch after 30 days


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _fresh(path: Path) -> bool:
    return path.exists() and time.time() - path.stat().st_mtime < MAX_AGE_S


def cached_series(key: str, fetch) -> tuple[pd.Series, str]:
    """Return (monthly Series with DatetimeIndex, fetched_at). fetch() -> Series on a miss."""
    path = CACHE_DIR / f"{key}.json"
    if _fresh(path):
        blob = json.loads(path.read_text())
        s = pd.Series(blob["values"], index=pd.to_datetime(blob["dates"]), dtype=float, name=blob["name"])
        return s, blob["fetched_at"]
    s = fetch()
    fetched_at = _now()
    CACHE_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps({
        "fetched_at": fetched_at, "name": s.name,
        "dates": [d.strftime("%Y-%m-%d") for d in s.index],
        "values": [None if np.isnan(v) else float(v) for v in s.values],
    }))
    return s, fetched_at


def cached_grid(key: str, fetch) -> tuple[dict, str]:
    """Return (dict of arrays: values[time,lat,lon], lats, lons, dates, fetched_at). fetch() -> same dict."""
    path = CACHE_DIR / f"{key}.npz"
    if _fresh(path):
        with np.load(path) as z:
            return {k: z[k] for k in ("values", "lats", "lons", "dates")}, str(z["fetched_at"])
    grid = fetch()
    fetched_at = _now()
    CACHE_DIR.mkdir(exist_ok=True)
    np.savez_compressed(path, fetched_at=fetched_at, **grid)
    return grid, fetched_at


def cached_blob(key: str, compute, newer_than: str | None = None) -> bytes:
    """Return computed bytes (e.g. a serialised API response) from disk, or compute() and store them.

    The entry is stale after MAX_AGE_S, or when the raw cache file `newer_than` was rewritten after it.
    """
    path = CACHE_DIR / key
    if _fresh(path) and not (newer_than and (CACHE_DIR / newer_than).exists()
                             and (CACHE_DIR / newer_than).stat().st_mtime > path.stat().st_mtime):
        return path.read_bytes()
    blob = compute()
    CACHE_DIR.mkdir(exist_ok=True)
    path.write_bytes(blob)
    return blob
