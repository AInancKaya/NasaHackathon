// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef, useState } from "react";
import { ApiError, getSeries, getTwin, getWitness, type Series, type Variable, type Witness } from "./api";
import EvidenceChart from "./EvidenceChart";
import VerdictCards from "./VerdictCards";

const errText = (e: unknown) => (e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.");
const CLOSE_MS = 180; // exit is quicker than the 280 ms entrance

const place = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;

function signed(x: number): string {
  const r = Math.abs(x) >= 0.01 || x === 0 ? x.toFixed(2) : x.toPrecision(2);
  return x > 0 ? `+${r}` : r.replace("-", "−");
}

interface Props {
  variable: Variable;
  lat: number;
  lon: number;
  box?: number | null; // set by case tours: analyse the box mean instead of one point
  onClose: () => void;
  onGoto: (lat: number, lon: number) => void;
}

export default function CaseFile({ variable, lat, lon, box, onClose, onGoto }: Props) {
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [witness, setWitness] = useState<Witness | null>(null);
  const [witnessError, setWitnessError] = useState<string | null>(null);
  const [witnessBusy, setWitnessBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const witnessAc = useRef<AbortController | null>(null);
  const [twinMsg, setTwinMsg] = useState<string | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);
  const id = variable.id;

  useEffect(() => {
    const ac = new AbortController();
    setSeries(null);
    setError(null);
    setWitness(null);
    setWitnessError(null);
    setWitnessBusy(false);
    setTwinMsg(null);
    getSeries(id, lat, lon, ac.signal, box)
      .then(setSeries)
      .catch((e: Error) => e.name !== "AbortError" && setError(errText(e)));
    return () => {
      ac.abort();
      witnessAc.current?.abort();
    };
  }, [id, lat, lon, box]);

  // The ERA5 check is on demand: it is a second upstream request, so only run it when asked.
  async function checkWitness() {
    const ac = new AbortController();
    witnessAc.current = ac;
    setWitnessBusy(true);
    setWitnessError(null);
    try {
      setWitness(await getWitness(id, lat, lon, ac.signal));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setWitnessError(errText(e));
    }
    setWitnessBusy(false);
  }

  function close() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }

  async function findTwin() {
    setTwinBusy(true);
    setTwinMsg(null);
    try {
      const t = await getTwin(id, lat, lon);
      if (t.twin) onGoto(t.twin.lat, t.twin.lon);
      else setTwinMsg("No opposite twin exists: no cell on the map has a significant trend in the opposite direction.");
    } catch (e) {
      setTwinMsg(errText(e));
    }
    setTwinBusy(false);
  }

  const st = series?.stats;
  const rising = st ? st.sen_per_decade > 0 : false;
  const years = series ? `${series.dates[0].slice(0, 4)}–${series.dates[series.dates.length - 1].slice(0, 4)}` : "";

  return (
    <aside className={`panel casefile${closing ? " closing" : ""}`} aria-label="Case file">
      <div className="sheet-grip" aria-hidden="true" />
      <header className="cf-head">
        <div>
          <span className="eyebrow">Case file</span>
          <h2 className="cf-title">{variable.name}</h2>
          <span className="cf-place mono">{box ? `${box}° box around ${place(lat, lon)}` : place(lat, lon)}</span>
        </div>
        <button className="btn icon" onClick={close} aria-label="Close case file">
          ✕
        </button>
      </header>

      {error ? (
        <p className="error cf-block" role="alert">
          {error}
        </p>
      ) : !series || !st ? (
        <div className="cf-block cf-loading" role="status">
          <div className="spinner" aria-hidden="true" />
          Gathering the evidence…
        </div>
      ) : (
        <>
          <section
            className={`headline ${!series.verdict.significant ? "flat" : rising ? "up" : "down"}`}
            aria-label="Verdict"
          >
            <div className="headline-value">
              <span className="num mono">{signed(st.sen_per_decade)}</span>
              <span className="unit">{variable.unit} per decade</span>
            </div>
            <div className="headline-meta">
              <span className={`pill ${series.verdict.significant ? "yes" : "no"}`}>
                {series.verdict.significant ? "Significant" : "Not significant"}
              </span>
              <span className="muted">
                {st.trend === "no trend" ? "No clear trend" : rising ? "Rising" : "Falling"} · {years}
              </span>
            </div>
          </section>

          <section className="cf-block" aria-label="Evidence chart">
            <h3 className="cf-h">The evidence</h3>
            <EvidenceChart series={series} unit={variable.unit} />
          </section>

          <VerdictCards series={series} unit={variable.unit} />
          <p className="muted small">
            {series.source} · fetched {series.fetched_at}
          </p>
        </>
      )}

      <section className="cf-block actions" aria-label="Next steps">
        <h3 className="cf-h">Test it</h3>
        {variable.has_witness && (
          <div className="action">
            <button className="btn wide" onClick={checkWitness} disabled={witnessBusy || !!witness}>
              {witnessBusy ? "Asking ERA5…" : witness ? "Second dataset checked" : "Ask a second dataset (ERA5)"}
            </button>
            <div aria-live="polite">
              {witnessError && <p className="error small">{witnessError}</p>}
              {witness && (
                <div className={`witness ${witness.agrees ? "agree" : "disagree"}`}>
                  <span className="pill yes">{witness.agrees ? "ERA5 agrees" : "ERA5 disagrees"}</span>
                  <p className="mono small">
                    ERA5 {signed(witness.sen_per_decade)} · NASA POWER {signed(witness.primary_sen_per_decade)}{" "}
                    {variable.unit}/decade
                  </p>
                  <p className="muted small">
                    {witness.source} · fetched {witness.fetched_at}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="action">
          <button className="btn wide primary" onClick={findTwin} disabled={twinBusy}>
            {twinBusy ? "Searching…" : "Fly to the opposite twin"}
          </button>
          {twinMsg && (
            <p className="muted" role="status">
              {twinMsg}
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
