// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef, useState } from "react";
import { ApiError, getSeries, getTwin, getWitness, type Series, type Variable, type Witness } from "./api";
import EvidenceChart, { type Compare } from "./EvidenceChart";
import { IconCheck, IconClose, IconPrint, IconShare } from "./icons";
import { fmtFetched } from "./varmeta";
import VerdictCards from "./VerdictCards";
import "./print.css";

const errText = (e: unknown) => (e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.");
const CLOSE_MS = 180; // exit is quicker than the 280 ms entrance

/** The deep link for this case: the app opens it from ?var=&lat=&lon=(&box=). */
export function caseUrl(v: string, lat: number, lon: number, box?: number | null): string {
  const q = new URLSearchParams({ var: v, lat: lat.toFixed(2), lon: lon.toFixed(2) });
  if (box) q.set("box", String(box));
  return `${location.origin}${location.pathname}?${q}`;
}

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
  /** Set when a case tour opened this file: the cited paper's finding, compared with the live verdict. */
  paper?: { expect: "rising" | "falling" | "none"; finding: string };
}

export default function CaseFile({ variable, lat, lon, box, onClose, onGoto, paper }: Props) {
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [witness, setWitness] = useState<Witness | null>(null);
  const [witnessError, setWitnessError] = useState<string | null>(null);
  const [witnessBusy, setWitnessBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const witnessAc = useRef<AbortController | null>(null);
  const [twinMsg, setTwinMsg] = useState<string | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);
  const [shared, setShared] = useState<"copied" | "manual" | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Origin of a twin flight: kept while the case file shows the twin it flew to.
  const [origin, setOrigin] = useState<{ varId: string; twin: { lat: number; lon: number }; series: Series; label: string } | null>(null);
  const id = variable.id;
  const cmp = origin && origin.varId === id && origin.twin.lat === lat && origin.twin.lon === lon ? origin : null;
  const link = caseUrl(id, lat, lon, box);

  useEffect(() => {
    const ac = new AbortController();
    setSeries(null);
    setError(null);
    setWitness(null);
    setWitnessError(null);
    setWitnessBusy(false);
    setTwinMsg(null);
    setShared(null);
    getSeries(id, lat, lon, ac.signal, box)
      .then(setSeries)
      .catch((e: Error) => e.name !== "AbortError" && setError(errText(e)));
    return () => {
      ac.abort();
      witnessAc.current?.abort();
    };
  }, [id, lat, lon, box, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function share() {
    try {
      await navigator.clipboard.writeText(link);
      setShared("copied");
    } catch {
      setShared("manual"); // clipboard blocked: show the link to copy by hand
    }
  }

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
      if (t.twin) {
        if (series) {
          setOrigin({
            varId: id, twin: t.twin, series,
            label: box ? `${box}° box around ${place(lat, lon)}` : place(lat, lon),
          });
        }
        onGoto(t.twin.lat, t.twin.lon);
      }
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
          {!box && (
            <span className="cf-scale">
              A regional average from a model grid cell about 50 km across, not a street-level measurement.
            </span>
          )}
        </div>
        <div className="cf-tools">
          <button className="btn icon" onClick={() => window.print()} aria-label="Print this case" title="Print this case">
            <IconPrint size={18} />
          </button>
          <button className="btn icon" onClick={share} aria-label="Share this case" title="Share this case">
            {shared === "copied" ? <IconCheck size={18} /> : <IconShare size={18} />}
          </button>
          <button className="btn icon" onClick={close} aria-label="Close case file" title="Close (Esc)">
            <IconClose size={18} />
          </button>
        </div>
      </header>

      <div aria-live="polite">
        {shared === "copied" && <p className="cf-shared small">Link copied. Anyone who opens it lands on this case.</p>}
        {shared === "manual" && (
          <label className="cf-shared small">
            Copy this link:
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} autoFocus />
          </label>
        )}
      </div>

      {error ? (
        <div className="cf-block cf-error" role="alert">
          <p className="error">The evidence for this place could not be loaded.</p>
          <p className="muted small mono">{error}</p>
          <button className="btn" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </button>
        </div>
      ) : !series || !st ? (
        <div className="cf-skeleton" role="status" aria-label="Gathering the evidence">
          <div className="sk sk-headline" />
          <div className="sk-label">Gathering the evidence: reading NASA POWER for this place…</div>
          <div className="sk sk-chart" />
          <div className="sk-cards">
            <div className="sk sk-card wide" />
            <div className="sk sk-card" />
            <div className="sk sk-card" />
          </div>
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
          {paper && (
            <PaperCheck
              paper={paper}
              live={!series.verdict.significant ? "none" : rising ? "rising" : "falling"}
              years={years}
            />
          )}

          <section className="cf-block" aria-label="Evidence chart">
            <h3 className="cf-h">The evidence</h3>
            <EvidenceChart
              series={series}
              unit={variable.unit}
              label={cmp ? place(lat, lon) : undefined}
              other={cmp ? ({ series: cmp.series, label: cmp.label } satisfies Compare) : undefined}
            />
          </section>

          {cmp && (
            <section className="cf-block compare" aria-label="Twin comparison">
              <h3 className="cf-h">Opposite twins</h3>
              <div className="cmp-grid">
                {[
                  { label: cmp.label, s: cmp.series, c: "var(--cmp-a)" },
                  { label: place(lat, lon), s: series, c: "var(--cmp-b)" },
                ].map((x) => (
                  <div className="cmp-card" key={x.c} style={{ borderColor: x.c }}>
                    <span className="cmp-place mono small" style={{ color: x.c }}>
                      {x.c === "var(--cmp-a)" ? "Origin" : "Twin"} · {x.label}
                    </span>
                    <span className="num mono">{signed(x.s.stats.sen_per_decade)}</span>
                    <span className="muted small">
                      {variable.unit} per decade · {x.s.verdict.significant ? "significant" : "not significant"}
                    </span>
                  </div>
                ))}
              </div>
              <button className="btn" onClick={() => setOrigin(null)}>
                Clear comparison
              </button>
            </section>
          )}

          <VerdictCards series={series} unit={variable.unit} />
          <p className="muted small">
            {series.source} · fetched {fmtFetched(series.fetched_at)}
          </p>
          <p className="print-only small">Case link: {link}</p>
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
                  <p className="small">
                    {witness.agrees
                      ? "A second, partly independent dataset shows the same direction of change here."
                      : "A second, partly independent dataset shows the opposite direction here. Treat this trend with caution."}
                    {box ? " This check compares the centre point, not the whole box." : ""}
                  </p>
                  <p className="mono small">
                    ERA5 {signed(witness.sen_per_decade)} · NASA POWER {signed(witness.primary_sen_per_decade)}{" "}
                    {variable.unit}/decade
                  </p>
                  <p className="muted small">
                    {witness.source} · fetched {fmtFetched(witness.fetched_at)}
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

      <section className="print-only cf-questions" aria-hidden="true">
        <h3 className="cf-h">Questions for the class</h3>
        <ol>
          <li>Is this trend statistically significant? What does that tell you, and what does it not tell you?</li>
          <li>What does the second dataset say about this place? If it disagrees, what could explain that?</li>
          <li>Why might the opposite twin behave differently? Which physical factors could differ between the two places?</li>
        </ol>
      </section>
    </aside>
  );
}

const DIR_TEXT = { rising: "a significant rise", falling: "a significant fall", none: "no significant trend" };

/** Tour check: does the live record agree with the cited paper? Shown honestly either way. */
function PaperCheck({ paper, live, years }: { paper: NonNullable<Props["paper"]>; live: keyof typeof DIR_TEXT; years: string }) {
  const agrees = paper.expect === live;
  return (
    <section className={`paper-check ${agrees ? "agrees" : "differs"}`} aria-label="Paper versus live data">
      <div className="paper-check-head">
        <h3 className="cf-h">Paper vs live data</h3>
        <span className={`pill ${agrees ? "yes" : "no"}`}>{agrees ? "Agrees" : "Differs"}</span>
      </div>
      <p>
        <strong>The paper found:</strong> {paper.finding}
      </p>
      <p>
        <strong>Live NASA data, {years}:</strong> {DIR_TEXT[live]}.
      </p>
      {!agrees && (
        <p className="muted">
          A different period, place or method can change the answer. That is part of the detective work: check
          the evidence below and how many more years would be needed.
        </p>
      )}
    </section>
  );
}
