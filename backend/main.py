# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""TerraTrend API (FastAPI). Contract: docs/CONTRACT.md."""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.catalog import VARIABLES
from backend.sources import NoDataError, UpstreamError

app = FastAPI(title="TerraTrend")


class BadRequest(Exception):
    pass


def _error(status: int, error: str, detail: str) -> JSONResponse:
    return JSONResponse({"error": error, "detail": detail}, status_code=status)


@app.exception_handler(BadRequest)
async def _bad_request(_: Request, e: BadRequest):
    return _error(400, "bad_request", str(e))


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
     "question": "Is the Arctic really warming faster than the rest of the planet?",
     "var": "t2m", "lat": 80.0, "lon": 20.0, "box": 5.0,
     "citation": "Rantanen et al. (2022), Communications Earth & Environment: "
                 "The Arctic has warmed nearly four times faster than the globe since 1979.",
     "citation_url": "https://doi.org/10.1038/s43247-022-00498-3"},
    {"id": "antarctic-peninsula", "title": "The pause at the bottom of the world",
     "question": "Did the Antarctic Peninsula keep warming, or did it stall?",
     "var": "t2m", "lat": -65.0, "lon": -63.0, "box": 5.0,
     "citation": "Turner et al. (2016), Nature: Absence of 21st century warming on Antarctic "
                 "Peninsula consistent with natural variability.",
     "citation_url": "https://doi.org/10.1038/nature18645"},
    {"id": "mediterranean", "title": "The thirsty Mediterranean",
     "question": "Is the Mediterranean getting drier?",
     "var": "prectotcorr", "lat": 38.0, "lon": 20.0, "box": 10.0,
     "citation": "Hoerling et al. (2012), Journal of Climate: "
                 "On the Increased Frequency of Mediterranean Drought.",
     "citation_url": "https://doi.org/10.1175/JCLI-D-11-00296.1"},
    {"id": "sahel", "title": "The Sahel's rain",
     "question": "Is the Sahel's rainfall coming back after the great drought?",
     "var": "prectotcorr", "lat": 14.0, "lon": 0.0, "box": 10.0,
     "citation": "Biasutti (2019), WIREs Climate Change: "
                 "Rainfall trends in the African Sahel: Characteristics, processes, and causes.",
     "citation_url": "https://doi.org/10.1002/wcc.591"},
    {"id": "southwest-us", "title": "The Southwest dries out",
     "question": "Are the soils of the American Southwest drying?",
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


dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
