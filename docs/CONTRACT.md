<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. -->

# API contract (frozen in S0)

Single source of truth between backend and frontend sessions. Field names and types below are
binding. Changing them requires a dedicated, announced step that updates this file first.

## Conventions

- Base path: `/api`. All responses are JSON, UTF-8.
- Types: `str`, `float`, `int`, `bool`, `null`; `T[]` is an array; `T[][]` is a 2D array
  indexed `[lat_index][lon_index]`. `float | null` means a missing value (never a fill number).
- Dates: `"YYYY-MM"` strings (monthly data). Timestamps: ISO 8601 UTC, e.g. `"2026-11-14T13:20:00Z"`.
- Coordinates: `lat` in [-90, 90], `lon` in [-180, 180], decimal degrees.
- `var`: a variable `id` from `GET /api/variables`.
- `start`, `end`: integer years, inclusive. Defaults are the variable's full available range.
- Slopes are per decade, in the variable's `unit`.
- Significance level: alpha = 0.05.
- `fetched_at`: when the underlying data was fetched from the live source (cache keeps the
  original timestamp).
- No synthetic or fallback data. On failure the API returns an error (see Errors).

## Errors

Any non-2xx response has this body:

```
{ "error": str, "detail": str }
```

| Status | `error` | When |
|---|---|---|
| 400 | `"bad_request"` | invalid or missing parameter |
| 404 | `"not_found"` | unknown `var`, or no data for that place/period |
| 422 | `"insufficient_data"` | fewer than 36 valid months |
| 502 | `"upstream_error"` | NASA POWER / Zarr / Open-Meteo failed |

---

## `GET /api/variables`

Response: `Variable[]`

```
Variable {
  id: str               // stable key, e.g. "t2m"
  name: str             // display name, e.g. "Surface air temperature"
  source: str           // e.g. "NASA POWER (MERRA-2)"
  param: str            // upstream parameter code, e.g. "T2M"
  unit: str             // e.g. "°C"
  description: str      // plain-language definition
  why_it_matters: str
  start_year: int       // first year available
  end_year: int         // last full year available
  has_map: bool         // true if GET /api/trendmap supports it
  has_witness: bool     // true if GET /api/witness supports it
}
```

## `GET /api/series`

Query: `var: str`, `lat: float`, `lon: float`, optional `box: float` (box side in degrees,
0 < box <= 10; when set, the result is the cos(lat)-weighted mean over the box centred on
lat/lon), optional `start: int`, `end: int`.

Response:

```
{
  var: str
  lat: float
  lon: float
  box: float | null
  dates: str[]                 // "YYYY-MM", length n
  values: (float | null)[]     // raw monthly values, unit of var
  anomaly: (float | null)[]    // values minus monthly climatology of the period
  fit: float[]                 // linear trend line on the values scale
  lo: float[]                  // lower 95% confidence band of fit
  hi: float[]                  // upper 95% confidence band of fit
  stats: {
    n: int                     // number of valid months
    mk_p: float                // seasonal Mann-Kendall p-value
    mk_p_hr: float             // Mann-Kendall p-value, Hamed-Rao autocorrelation-corrected
    tau: float                 // Kendall's tau
    trend: str                 // "increasing" | "decreasing" | "no trend"
    sen_per_decade: float      // Sen's slope
    sen_ci: [float, float]     // 95% CI of Sen's slope, per decade
    reg_per_decade: float      // OLS slope on anomalies
    reg_ci: [float, float]     // 95% CI of OLS slope, per decade
    reg_p: float
    reg_r2: float
    ttest_t: float             // Welch t-test, annual anomalies, first vs second half
    ttest_p: float
    years_to_detect: float | null  // Weatherhead (1998) years needed to detect the trend;
                                   // null when already significant
  }
  verdict: {
    what: str                  // "What is changing?"
    where: str                 // "Where?"
    how_much: str              // "How much?"
    significant: bool          // "Is it significant?" (decided on mk_p_hr < 0.05)
    significant_text: str
  }
  source: str
  fetched_at: str
}
```

## `GET /api/witness`

Second, partly independent dataset (Copernicus ERA5 via Open-Meteo; a different reanalysis, though it assimilates many of the same observations as MERRA-2) for the same place and period.

Query: `var: str`, `lat: float`, `lon: float`, optional `start: int`, `end: int`.

Response:

```
{
  var: str
  lat: float
  lon: float
  source: str                  // e.g. "Copernicus ERA5 (Open-Meteo)"
  sen_per_decade: float
  mk_p: float
  primary_sen_per_decade: float  // NASA POWER Sen's slope for the same request
  agrees: bool                   // true if both slopes have the same sign
  fetched_at: str
}
```

## `GET /api/trendmap`

Query: `var: str` (must have `has_map: true`).

Response:

```
{
  var: str
  lats: float[]                // cell centres, ascending
  lons: float[]                // cell centres, ascending
  slope: (float | null)[][]    // Sen's slope per decade, [lat][lon]
  sig: (bool | null)[][]       // significant after a lag-1 autocorrelation correction of each cell's
                               // seasonal MK p-value, then Benjamini-Hochberg FDR (q = 0.05), [lat][lon]
  period: [int, int]           // [start_year, end_year]
  unit: str
  source: str
  fetched_at: str
}
```

## `GET /api/twin`

The cell with the strongest significant trend in the opposite direction to the given place.

Query: `var: str`, `lat: float`, `lon: float`.

Response:

```
{
  var: str
  origin: { lat: float, lon: float, sen_per_decade: float | null }
  twin: { lat: float, lon: float, sen_per_decade: float } | null   // null if none exists
  period: [int, int]
  fetched_at: str
}
```

## `GET /api/cases`

Curated demo tours. Location, variable, and citation only. **No numbers**; all numbers are
computed live via `/api/series`.

Response: `Case[]`

```
Case {
  id: str
  title: str
  question: str           // the detective question the case answers
  var: str
  lat: float
  lon: float
  box: float | null
  citation: str           // published reference for the phenomenon
  citation_url: str
}
```

## `GET /api/geocode`

Added after S0 (announced addition; no existing field changed). Place-name search through the
Open-Meteo geocoding API, so a user can find a town by name. Not a data endpoint: no numbers.

Query: `q: str` (place name, 1 to 100 characters).

Response: `Place[]`, up to 5 entries, best match first.

```
Place {
  name: str
  country: str | null
  admin1: str | null      // region or state, when known
  lat: float
  lon: float
}
```

Errors: 400 `bad_request` for a missing or empty `q`; 404 `not_found` when no place matches;
502 `upstream_error` when the geocoding service fails.
