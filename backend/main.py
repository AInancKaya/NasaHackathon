# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""TerraVestige API (FastAPI). Contract: docs/CONTRACT.md."""
import asyncio
import json
import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.cache import cached_blob
from backend.catalog import BY_ID, ERA5_DAILY, VARIABLES
from backend.sources import NoDataError, UpstreamError, era5, geocode, power_grid, power_point, power_region
from backend.stats.field import trend_field
from backend.stats.trend import analyze_trend

log = logging.getLogger("terravestige")


@asynccontextmanager
async def _lifespan(_: FastAPI):
    task = asyncio.create_task(_warm_maps())  # never blocks startup
    yield
    task.cancel()


app = FastAPI(title="TerraVestige", lifespan=_lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


class BadRequest(Exception):
    pass


class InsufficientData(Exception):
    pass


def _error(status: int, error: str, detail: str) -> JSONResponse:
    return JSONResponse({"error": error, "detail": detail}, status_code=status)


@app.exception_handler(BadRequest)
async def _bad_request(_: Request, e: BadRequest):
    return _error(400, "bad_request", str(e))


@app.exception_handler(InsufficientData)
async def _insufficient(_: Request, e: InsufficientData):
    return _error(422, "insufficient_data", str(e))


@app.exception_handler(NoDataError)
async def _no_data(_: Request, e: NoDataError):
    return _error(404, "not_found", str(e))


@app.exception_handler(UpstreamError)
async def _upstream(_: Request, e: UpstreamError):
    return _error(502, "upstream_error", str(e))


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, e: StarletteHTTPException):
    kind = {404: "not_found", 405: "bad_request"}.get(e.status_code, "bad_request")
    return _error(e.status_code, kind, str(e.detail))


@app.exception_handler(Exception)
async def _unexpected(_: Request, e: Exception):
    return _error(500, "internal_error", f"{type(e).__name__}: {e}")


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, e: RequestValidationError):
    msg = "; ".join(f"{'.'.join(map(str, x['loc'][1:]))}: {x['msg']}" for x in e.errors())
    return _error(400, "bad_request", msg)


# CASES: location, variable and citation only. All numbers are computed live via /api/series.
# Every citation_url is a DOI that resolves; titles/authors were checked against Crossref.
CASES = [
    {"id": "arctic", "title": "The Arctic fever",
     "question": "Is the Arctic warming, and how fast? Compare it with a place near you.",
     "var": "t2m", "lat": 80.0, "lon": 20.0, "box": 5.0,
     "citation": "Rantanen et al. (2022), Communications Earth & Environment: "
                 "The Arctic has warmed nearly four times faster than the globe since 1979.",
     "citation_url": "https://doi.org/10.1038/s43247-022-00498-3"},
    {"id": "arctic-sea-ice", "title": "The shrinking sea ice",
     "question": "Is the sea ice in the Barents Sea, north of Norway and Russia, shrinking?",
     "var": "frseaice", "lat": 77.0, "lon": 40.0, "box": 5.0,
     "citation": "Stroeve & Notz (2018), Environmental Research Letters: "
                 "Changing state of Arctic sea ice across all seasons.",
     "citation_url": "https://doi.org/10.1088/1748-9326/aade56"},
    {"id": "antarctic-peninsula", "title": "The pause at the bottom of the world",
     "question": "Did the Antarctic Peninsula keep warming, or did the warming stall?",
     "var": "t2m", "lat": -65.0, "lon": -63.0, "box": 5.0,
     "citation": "Turner et al. (2016), Nature: Absence of 21st century warming on Antarctic "
                 "Peninsula consistent with natural variability.",
     "citation_url": "https://doi.org/10.1038/nature18645"},
    {"id": "mediterranean", "title": "The Mediterranean drought puzzle",
     "question": "Studies of the 20th century found the Mediterranean drying. Is that drying "
                 "detectable in the satellite-era rainfall record, or would it take many more years?",
     "var": "prectotcorr", "lat": 38.0, "lon": 20.0, "box": 10.0,
     "citation": "Hoerling et al. (2012), Journal of Climate: "
                 "On the Increased Frequency of Mediterranean Drought.",
     "citation_url": "https://doi.org/10.1175/JCLI-D-11-00296.1"},
    {"id": "sahel", "title": "The Sahel's rain",
     "question": "Is rain returning to the Sahel after the great drought of the 1970s and 80s?",
     "var": "prectotcorr", "lat": 14.0, "lon": 0.0, "box": 10.0,
     "citation": "Biasutti (2019), WIREs Climate Change: "
                 "Rainfall trends in the African Sahel: Characteristics, processes, and causes.",
     "citation_url": "https://doi.org/10.1002/wcc.591"},
    {"id": "southwest-us", "title": "The Southwest dries out",
     "question": "Is the soil of the American Southwest getting drier?",
     "var": "gwettop", "lat": 37.0, "lon": -110.0, "box": 10.0,
     "citation": "Williams et al. (2020), Science: Large contribution from anthropogenic warming "
                 "to an emerging North American megadrought.",
     "citation_url": "https://doi.org/10.1126/science.aaz9600"},
]


@app.get("/api/variables")
def variables():
    return VARIABLES


@app.get("/api/cases")
def cases():
    return CASES


@app.get("/api/geocode")
def geocode_place(q: str = Query(..., min_length=1, max_length=100)):
    query = q.strip()
    if not query:
        raise BadRequest("q must not be empty.")
    return geocode.search(query)


@app.get("/api/reverse")
def reverse_place(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return geocode.reverse(lat, lon)


def _variable(var: str, need: str | None = None) -> dict:
    v = BY_ID.get(var)
    if v is None:
        raise NoDataError(f"Unknown variable '{var}'. See /api/variables.")
    if need and not v[need]:
        raise BadRequest(f"Variable '{var}' does not support this endpoint ({need} is false).")
    return v


def _years(v: dict, start: int | None, end: int | None) -> tuple[int, int]:
    start = v["start_year"] if start is None else start
    end = v["end_year"] if end is None else end
    if not (v["start_year"] <= start <= end <= v["end_year"]):
        raise BadRequest(f"start/end must satisfy {v['start_year']} <= start <= end <= {v['end_year']}.")
    return start, end


def _slice(s: pd.Series, start: int, end: int) -> pd.Series:
    s = s[(s.index.year >= start) & (s.index.year <= end)]
    if s.notna().sum() < 36:
        raise InsufficientData(f"At least 36 valid months are needed (got {int(s.notna().sum())}).")
    return s


def _power_series(v: dict, lat: float, lon: float, box: float | None, start: int, end: int):
    """NASA POWER monthly series for the period (the full range is fetched, so the cache is shared)."""
    if box is None:
        s, fetched_at = power_point.fetch_monthly(lat, lon, v["start_year"], v["end_year"], v["param"])
    else:
        s, fetched_at = power_region.fetch_box_monthly(lat, lon, box, v["start_year"], v["end_year"], v["param"])
    return _slice(s, start, end), fetched_at


def _where(lat: float, lon: float, box: float | None) -> str:
    return (f"{lat:.2f}°, {lon:.2f}°" if box is None
            else f"{box:g}°-wide box centred on {lat:.2f}°, {lon:.2f}°")


def _nan_to_none(a) -> list:
    return [None if np.isnan(x) else float(x) for x in a]


@app.get("/api/series")
def series(var: str, lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
           box: float | None = Query(None, gt=0, le=10), start: int | None = None, end: int | None = None):
    v = _variable(var)
    start, end = _years(v, start, end)
    s, fetched_at = _power_series(v, lat, lon, box, start, end)
    result = analyze_trend(s, v["name"], v["unit"], _where(lat, lon, box))
    return {
        "var": var, "lat": lat, "lon": lon, "box": box,
        "dates": [d.strftime("%Y-%m") for d in s.index],
        "values": _nan_to_none(s.values),
        **result, "source": v["source"], "fetched_at": fetched_at,
    }


@app.get("/api/witness")
def witness(var: str, lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180),
            start: int | None = None, end: int | None = None):
    v = _variable(var, "has_witness")
    start, end = _years(v, start, end)
    primary, _ = _power_series(v, lat, lon, None, start, end)
    e, fetched_at = era5.fetch_monthly(lat, lon, v["start_year"], v["end_year"], ERA5_DAILY[v["param"]])
    stats = analyze_trend(_slice(e, start, end), v["name"], v["unit"], "")["stats"]
    primary_sen = analyze_trend(primary, v["name"], v["unit"], "")["stats"]["sen_per_decade"]
    return {
        "var": var, "lat": lat, "lon": lon, "source": "Copernicus ERA5 (Open-Meteo)",
        "sen_per_decade": stats["sen_per_decade"], "mk_p": stats["mk_p"],
        "primary_sen_per_decade": primary_sen,
        "agrees": bool(np.sign(stats["sen_per_decade"]) == np.sign(primary_sen)),
        "fetched_at": fetched_at,
    }


_maps: dict[str, bytes] = {}  # serialised /api/trendmap responses, per variable
_map_locks: dict[str, threading.Lock] = {}  # one computation per variable; concurrent requests wait for it


def _compute_map(v: dict) -> bytes:
    grid, fetched_at = power_grid.fetch_grid(v["param"])
    years = np.array([int(d[:4]) for d in grid["dates"]])
    keep = (years >= v["start_year"]) & (years <= v["end_year"])
    result = trend_field(grid["values"][keep])
    result["slope"] = [[None if x is None else round(x, 4) for x in row] for row in result["slope"]]
    return json.dumps({
        "var": v["id"], "lats": grid["lats"].tolist(), "lons": grid["lons"].tolist(),
        **result, "period": [v["start_year"], v["end_year"]],
        "unit": v["unit"], "source": v["source"], "fetched_at": fetched_at,
    }).encode()


def _map_bytes(var: str) -> bytes:
    """Trend map response: memory, then disk (cache/trendmap_v2_*.json; v2 = autocorrelation-corrected sig), then computed from the grid."""
    v = _variable(var, "has_map")
    if var in _maps:
        return _maps[var]
    with _map_locks.setdefault(var, threading.Lock()):
        if var not in _maps:
            _maps[var] = cached_blob(f"trendmap_v2_{v['param']}.json", lambda: _compute_map(v),
                                     newer_than=f"power_grid_{v['param']}.npz")
        return _maps[var]


def _map(var: str) -> dict:
    return json.loads(_map_bytes(var))


async def _warm_maps() -> None:
    """Fill the trend map cache in the background, default map variable first."""
    for v in [x for x in VARIABLES if x["has_map"]]:
        try:
            await asyncio.to_thread(_map_bytes, v["id"])
        except Exception as e:  # warm-up only; a real request reports the error itself
            log.warning("warm-up of %s failed: %s", v["id"], e)


@app.get("/api/trendmap")
def trendmap(var: str):
    return Response(_map_bytes(var), media_type="application/json")


@app.get("/api/twin")
def twin(var: str, lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    m = _map(var)
    slope = np.array(m["slope"], dtype=float)
    sig = np.array(m["sig"], dtype=bool)  # null (no data) becomes False
    i = int(np.abs(np.array(m["lats"]) - lat).argmin())
    j = int(np.abs(np.array(m["lons"]) - lon).argmin())
    origin_slope = slope[i, j]
    found = None
    if np.isfinite(origin_slope) and origin_slope != 0:
        score = np.where(sig & (np.sign(slope) == -np.sign(origin_slope)), np.abs(slope), np.nan)
        if np.isfinite(score).any():
            a, b = np.unravel_index(np.nanargmax(score), score.shape)
            found = {"lat": m["lats"][a], "lon": m["lons"][b], "sen_per_decade": float(slope[a, b])}
    return {
        "var": var,
        "origin": {"lat": lat, "lon": lon,
                   "sen_per_decade": float(origin_slope) if np.isfinite(origin_slope) else None},
        "twin": found, "period": m["period"], "fetched_at": m["fetched_at"],
    }


class _Frontend(StaticFiles):
    """index.html is revalidated on every load, so a new build is picked up at once; Vite's hashed
    files under assets/ never change and can be cached for good."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", _Frontend(directory=dist, html=True), name="frontend")
