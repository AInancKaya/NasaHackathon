// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

// Method & data: sources, statistics with citations, limitations, AI-use disclosure. Links only.
const doi = (d: string) => `https://doi.org/${d}`;

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function Method() {
  return (
    <div className="method">
      <section>
        <h3>Data</h3>
        <ul>
          <li>
            <strong>Primary:</strong> <A href="https://power.larc.nasa.gov/">NASA POWER</A>, monthly values from the{" "}
            <A href="https://gmao.gsfc.nasa.gov/gmao-products/merra-2/">MERRA-2</A> reanalysis (and{" "}
            <A href="https://ceres.larc.nasa.gov/data/">CERES SYN1deg</A> for sunlight and cloud). Case files use the
            POWER point and regional API.
          </li>
          <li>
            <strong>Map:</strong> the{" "}
            <A href="https://registry.opendata.aws/nasa-power/">NASA POWER Zarr store on AWS Open Data</A>, read on a
            grid of about 2° and analysed cell by cell.
          </li>
          <li>
            <strong>Second opinion:</strong>{" "}
            <A href="https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels">Copernicus ERA5</A>, via
            the <A href="https://open-meteo.com/en/docs/historical-weather-api">Open-Meteo historical API</A>.
          </li>
          <li>
            <strong>Place search:</strong> <A href="https://open-meteo.com/en/docs/geocoding-api">Open-Meteo geocoding</A>.
          </li>
        </ul>
        <p className="muted small">
          Every number is fetched live (or from a cache of a live fetch, with its fetch time shown). Nothing is bundled.
        </p>
      </section>

      <section>
        <h3>Statistics</h3>
        <ul>
          <li>
            <strong>Trend test:</strong> seasonal Mann-Kendall, comparing each calendar month only with itself (
            <A href={doi("10.1029/WR018i001p00107")}>Hirsch, Slack &amp; Smith 1982</A>).
          </li>
          <li>
            <strong>Trend size:</strong> Sen's slope with a 95% interval (
            <A href={doi("10.1080/01621459.1968.10480934")}>Sen 1968</A>).
          </li>
          <li>
            <strong>Autocorrelation:</strong> case-file p-values use the Hamed-Rao variance correction (
            <A href={doi("10.1016/S0022-1694(97)00125-X")}>Hamed &amp; Rao 1998</A>); map cells use its lag-1
            form, so a cell is never more significant on the map than its persistence allows. The map and the case
            file can still disagree near the threshold: the case file uses the full correction.
          </li>
          <li>
            <strong>Many places at once:</strong> map cells are significant only after Benjamini-Hochberg false
            discovery rate control at q = 0.05 (<A href={doi("10.1111/j.2517-6161.1995.tb02031.x")}>Benjamini &amp; Hochberg 1995</A>
            ; for climate fields see <A href={doi("10.1175/BAMS-D-15-00267.1")}>Wilks 2016</A>).
          </li>
          <li>
            <strong>Years to detect:</strong> how much longer a record must be before a trend of this size is
            detectable (<A href={doi("10.1029/98JD00995")}>Weatherhead et al. 1998</A>).
          </li>
        </ul>
      </section>

      <section>
        <h3>Limitations</h3>
        <ul>
          <li>Reanalysis blends models with observations; it is not a weather-station record.</li>
          <li>The map grid (about 2°) is coarser than a case file, so a point can differ from the cell around it.</li>
          <li>A significant trend says something changed, not why or whether it will continue.</li>
          <li>
            Rainfall and wind vary a lot from year to year, so their trends need long records and can stay
            undetectable for decades.
          </li>
          <li>The "opposite twin" is a statistical contrast, not a physical link.</li>
        </ul>
      </section>

      <p className="muted small method-ai">
        Built for NASA Space Apps 2026. The code was written with assistance from Claude (Anthropic), an AI coding
        assistant, and reviewed and directed by the project author. NASA does not endorse this project.
      </p>
    </div>
  );
}
