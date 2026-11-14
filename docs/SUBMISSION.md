<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. Reviewed and directed by the project author. -->

# TerraVestige: Space Apps project page text

Copy each section into the matching field of the Space Apps project page. Replace every `<…>`.

## Project name

TerraVestige

## High-level summary

TerraVestige is a 3D globe that answers the question at the heart of the challenge: the same Earth
variable can rise in one place and fall in another, so where is it really changing, and is the change
real? It colours the planet by the trend of 14 NASA variables across the atmosphere, ocean, ice and
land (1981–2025), fades out every place where the trend is not statistically significant, and opens a
"case file" for any city or point: how fast it is changing, whether that is real (seasonal Mann-Kendall
with an autocorrelation correction), whether an independent dataset agrees, and where on Earth the
same variable is moving the opposite way. Every number is computed from NASA data fetched live from the source; nothing is
simulated or hand-entered.

## Links

- Project demo (30-second video): `<public video link>`
- Final project (live app): `<public app link>`
- Source code: `<GitHub repository link>`

## Project details

**What it does.** Pick a variable, such as surface air temperature, sea ice, snow cover, precipitation or
soil wetness, and the globe shows its trend per decade for every grid cell. Red rises and blue falls
(water variables use brown and teal, ice and snow use orange and purple). Faded colour means the trend
did not pass a significance test after correcting for testing thousands of places at once. Search a
city or click anywhere to open a case file with:

- the monthly record, its seasonal anomaly and a trend line with a 95% confidence band;
- four answers: what is changing, where, how much (Sen's slope per decade with its 95% interval), and
  is it significant;
- a second witness: the same trend computed from Copernicus ERA5, with a badge that shows whether the
  two datasets agree;
- the opposite twin: the place with the strongest significant trend in the other direction, shown
  side by side;
- "Has the pace changed?": an exploratory before-and-after rate around the best-fitting break year;
- "How many more years?": when a trend is not significant yet, how much longer the record would need
  to be to detect it (Weatherhead et al., 1998).

Six guided case tours (Arctic warming, Barents Sea ice, the Antarctic Peninsula pause, Mediterranean
drought, the Sahel's rain and the US Southwest's soil moisture) each cite a peer-reviewed paper and set its
finding next to the live 1981–2025 result, with an "Agrees" or "Differs" badge. Five of six agree. The
Mediterranean differs, and the app explains why: the paper studied the 20th century, and a different
period can change the answer. A three-question guide suggests a variable for a student's own
town, and a glossary and method panel explain every term.

**How it works.** A FastAPI backend reads NASA POWER directly: the MERRA-2 monthly Zarr store on the AWS
Open Data bucket for the global maps, and the NASA POWER point and regional APIs for case files. For
every grid cell it runs a seasonal Mann-Kendall test and Sen's slope, corrects the p-value for
month-to-month persistence, and applies Benjamini-Hochberg false-discovery-rate control across the
map. Case files use the Hamed-Rao autocorrelation-corrected test. The React and three.js frontend draws
the trend field on a globe with a GPU shader. Results are cached with their fetch time, which the
interface shows; the deployed image fills that cache from the live sources when it is built.

**Why it matters.** Climate change is not uniform, and a single global average hides that. TerraVestige
lets a student, a teacher or a journalist test their own place in a minute, with the same statistics
a climate scientist would use, and see honestly when the data cannot tell yet.

**Honesty by design.** Only real, live data is used, with no synthetic or bundled numbers. When a source
fails, the app says so instead of showing fallback data. Non-significant results are shown as such.
Limits are stated in the app: reanalysis is not a station record, and a case file is a regional
average about 50 km across.

**Tools.** Python (FastAPI, xarray, zarr, s3fs, NumPy, SciPy, pandas, pymannkendall), TypeScript
(React, Vite), three.js and globe.gl, Plotly, Docker, Google Cloud Run.

## Space agency data

- **NASA POWER**, MERRA-2 monthly fields: air temperature (mean, max, min), precipitation, relative
  humidity, wind speed, total column water vapour, surface soil wetness, surface skin temperature (sea
  surface over the oceans), sea ice cover, snow cover and evapotranspiration. Read from the MERRA-2 Zarr
  store on the AWS Open Data bucket `nasa-power` and from the NASA POWER point and regional APIs.
- **NASA POWER**, CERES SYN1deg: surface solar radiation and cloud cover.
- **NASA Blue Marble Next Generation** imagery for the globe.
- Independent check (not a space agency): Copernicus ERA5 through the Open-Meteo archive API.

## Use of artificial intelligence

The code and documentation were written with assistance from Claude (Anthropic), an AI coding
assistant, under the direction and review of the project author. Every source file carries an AI
disclosure header. The app itself uses no AI at run time: every result comes from rule-based
statistics on live NASA data.

## References

- Hirsch, Slack & Smith (1982), seasonal Mann-Kendall test. https://doi.org/10.1029/WR018i001p00107
- Sen (1968), Sen's slope. https://doi.org/10.1080/01621459.1968.10480934
- Hamed & Rao (1998), autocorrelation correction. https://doi.org/10.1016/S0022-1694(97)00125-X
- Benjamini & Hochberg (1995), false discovery rate. https://doi.org/10.1111/j.2517-6161.1995.tb02031.x
- Wilks (2016), FDR for climate fields. https://doi.org/10.1175/BAMS-D-15-00267.1
- Weatherhead et al. (1998), years to detect a trend. https://doi.org/10.1029/98JD00995
- Rantanen et al. (2022), Arctic amplification. https://doi.org/10.1038/s43247-022-00498-3
- Stroeve & Notz (2018), Arctic sea ice. https://doi.org/10.1088/1748-9326/aade56
- Turner et al. (2016), Antarctic Peninsula. https://doi.org/10.1038/nature18645
- Hoerling et al. (2012), Mediterranean drought. https://doi.org/10.1175/JCLI-D-11-00296.1
- Biasutti (2019), Sahel rainfall. https://doi.org/10.1002/wcc.591
- Williams et al. (2020), North American megadrought. https://doi.org/10.1126/science.aaz9600
