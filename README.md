<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. Reviewed and directed by the project author. -->

# TerraVestige — Be an Earth System Trend Detective

*Terra* (Earth) + *vestige* (a trace left behind): reading the traces of change that the Earth leaves in its data.

**NASA Space Apps Challenge 2026** · Challenge: *Be An Earth System Trend Detective!*

---

## English

### What is TerraVestige?

The same Earth variable can rise in one place and fall in another. TerraVestige shows this on a 3D globe.
Pick a variable, see where it is rising or falling across the whole planet, click any spot, and open a
"case file" that tells you, in plain words, what is changing, where, by how much, and whether the change
is statistically real. Everything is computed live from real data. There is no synthetic or bundled data.

### Features

1. **Global trend globe.** A 3D Earth coloured by the trend of the chosen variable (Sen's slope per decade).
   Cells whose trend is not statistically significant are faded, so noise is not mistaken for signal.
   Significance on the map uses Benjamini-Hochberg false-discovery-rate correction (q = 0.05).
2. **Case file for any place.** Click the globe or search for a city in the top bar (the case tours analyse a box average, up to 10° wide, instead of one point). You get the monthly series, the seasonality-free anomaly, a trend line with a 95% confidence band,
   and four answer cards: **What** is changing, **Where**, **How much**, and **Is it significant?**
3. **Evidence chart.** An interactive chart of the data, the fitted trend and its confidence band.
4. **Second witness.** The trend is re-computed from a second, partly independent dataset (Copernicus ERA5 through Open-Meteo; a different reanalysis that still shares many input observations with MERRA-2)
   and a badge shows whether both datasets agree on the direction. Available for 8 of 14 variables.
5. **Opposite twin.** Finds the cell with the strongest significant trend in the *opposite* direction and flies
   the globe there. This answers the challenge's core idea: a variable can go up here and down there.
6. **"How many more years?"** If a trend is not yet significant, the case file estimates how many more years of
   data would be needed to detect it (Weatherhead et al., 1998).
7. **Detective guide.** A three-question wizard (what are you curious about, where, what kind of place) that
   suggests a variable, plus a plain-language glossary and a short definition and "why it matters" for every variable.
8. **Ready-made case tours.** Six guided investigations (Arctic warming, Arctic sea ice, the Antarctic Peninsula
   pause, the Mediterranean rainfall, the Sahel's rain, the US Southwest's soil moisture). Each links to a peer-reviewed
   paper. The tours store only place, variable and citation. Every number is computed live.
9. **Honest errors.** If a data source fails, the API returns a clear error. It never silently shows fallback data.
   Every result shows when its data was fetched (`fetched_at`).

### Variables (14)

- **Atmosphere** (NASA POWER / MERRA-2): surface air temperature, daily maximum and minimum temperature,
  precipitation, relative humidity, wind speed, total column water vapour.
- **Ocean and ice** (NASA POWER / MERRA-2): sea and land surface temperature, sea ice cover, snow cover.
  Over the ocean, MERRA-2's sea surface temperature and sea ice come from satellite-based analyses.
- **Land and plants** (NASA POWER / MERRA-2): surface soil wetness, evapotranspiration (water given off by soil
  and plants).
- **Radiation and clouds** (NASA POWER / CERES): surface solar radiation, cloud cover.

The 12 MERRA-2 variables have a global trend map. Eight variables have a second-witness check against ERA5.
There is no vegetation index (NDVI) in NASA POWER; evapotranspiration is the closest plant-related quantity.

### Methods

- Seasonal Mann-Kendall test and Sen's slope, with a 95% confidence interval for the slope.
- Hamed-Rao correction of the p-value for autocorrelation. The "significant" verdict uses this corrected p-value.
- OLS regression on the anomalies and a Welch t-test (first half vs second half) as supporting evidence.
- On the map, each cell's p-value is first corrected for lag-1 autocorrelation (the lag-1 form of the Hamed-Rao
  correction), then Benjamini-Hochberg FDR is applied across all cells (Wilks, 2016).
- Scale: the map grid is about 2° (~200 km) and a case file reads one ~50 km model cell. Values are regional
  averages from reanalysis, so they do not resolve a city's own heat island.
- Years-to-detect estimate (Weatherhead et al., 1998).
- "Has the pace changed?": a continuous two-segment line on the annual anomalies (at least 10 years per side)
  gives the rate before and after the best-fitting break year. It is exploratory, with no p-value, because the
  break year is chosen from the data. (A Pettitt test is not used: it flags a "break" in any steady trend.)
- A vectorised map implementation is checked against the `pymannkendall` library in the test suite.
- Significance level α = 0.05. Slopes are per decade, in SI-based units shown next to every number
  (°C, mm/day, m/s, kg/m², MJ/m²/day, % and fraction).

### Data sources (all live, no login)

- **NASA POWER** point and regional APIs (MERRA-2 and CERES).
- **NASA POWER Zarr** on the open AWS bucket `nasa-power` (global grid for the trend maps).
- **Copernicus ERA5** through the **Open-Meteo** archive API (the second witness).

Responses are cached on disk (`cache/`, git-ignored) together with the original fetch time. No data files are in this repository.

### Architecture

- **Backend:** Python, FastAPI, xarray + zarr + s3fs, pandas, numpy, scipy, pymannkendall (`backend/`).
- **Frontend:** React + TypeScript + Vite, globe.gl / three.js, Plotly (`frontend/`).
- **Deployment:** one Docker container serving the API and the built frontend on port 7860 (deployable to Google Cloud Run). See [docs/DEPLOY.md](docs/DEPLOY.md).
- **API contract:** [docs/CONTRACT.md](docs/CONTRACT.md).

### Run locally

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
uvicorn backend.main:app --port 7860
# open http://localhost:7860
```

Tests: `pytest`.

### Use of artificial intelligence

This project was built with assistance from **Claude (Anthropic)**, an AI coding assistant, used through
Claude Code. Claude helped write the code, tests and documentation. The project author set the idea and the
requirements, directed the work, and reviewed the results. Each source file carries an AI-disclosure header.
**No AI model runs inside the product at request time.** All verdict texts are rule-based and all numbers come
from live data and the statistical code above.

### Branding and units

No NASA logos, emblems or insignia are used. NASA is named only as a data source. Units follow the International
System of Units (SI) or are shown explicitly next to every value.

### Acknowledgements

NASA POWER Project, NASA Earth science data, Copernicus Climate Change Service (ERA5), Open-Meteo, and the
open-source libraries listed above.
