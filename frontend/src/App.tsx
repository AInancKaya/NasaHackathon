// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getTrendMap, getVariables, type TrendMap, type Variable } from "./api";
import CaseTours from "./CaseTours";
import Glossary from "./Glossary";
import Wizard from "./Wizard";
import "./guide.css";
import Globe, { type GlobeHandle } from "./Globe";

// The case file pulls in Plotly (a few MB): load it only when someone opens a case.
const CaseFile = lazy(() => import("./CaseFile"));

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.";
}

type GuideTab = "wizard" | "cases" | "glossary";
const TABS: { id: GuideTab; label: string }[] = [
  { id: "wizard", label: "Guide me" },
  { id: "cases", label: "Case tours" },
  { id: "glossary", label: "Glossary" },
];

export default function App() {
  const globe = useRef<GlobeHandle>(null); 
  const [vars, setVars] = useState<Variable[] | null>(null);
  const [varsError, setVarsError] = useState<string | null>(null);
  const [varId, setVarId] = useState<string | null>(null);
  const [map, setMap] = useState<TrendMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [limit, setLimit] = useState(0);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);
  const [box, setBox] = useState<number | null>(null);
  const [guide, setGuide] = useState<GuideTab | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getVariables(ac.signal)
      .then((all) => {
        const withMap = all.filter((v) => v.has_map);
        setVars(withMap);
        setVarId((cur) => cur ?? withMap[0]?.id ?? null);
      })
      .catch((e) => e.name !== "AbortError" && setVarsError(errText(e)));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!varId) return;
    const ac = new AbortController();
    setLoading(true);
    setMapError(null);
    setMap(null);
    getTrendMap(varId, ac.signal)
      .then((m) => {
        setMap(m);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setMapError(errText(e));
        setLoading(false);
      });
    return () => ac.abort();
  }, [varId]);

  const onPick = useCallback((lat: number, lon: number) => {
    setBox(null);
    setPicked({ lat, lon });
  }, []);
  const onGoto = useCallback((lat: number, lon: number) => {
    globe.current?.flyTo(lat, lon);
    setBox(null);
    setPicked({ lat, lon });
  }, []);
  const openCase = useCallback((t: { varId: string; lat: number; lon: number; box?: number | null }) => {
    setVarId(t.varId);
    setGuide(null);
    globe.current?.flyTo(t.lat, t.lon);
    setBox(t.box ?? null);
    setPicked({ lat: t.lat, lon: t.lon });
  }, []);
  const current = vars?.find((v) => v.id === varId);
  const error = varsError ?? mapError;

  return (
    <div className="app">
      <Globe ref={globe} map={map} picked={picked} onPick={onPick} onLimit={setLimit} />

      {!picked && (
        <div className="hero">
          <h2>Where is Earth changing, and where is it changing the opposite way?</h2>
          <p>
            Red = rising, blue = falling. Faded = not significant. <strong>Click anywhere</strong> to open its case
            file.
          </p>
        </div>
      )}

      {(loading || !vars) && !error && (
        <div className="loading" role="status">
          <div className="spinner" aria-hidden="true" />
          {current ? `Loading the ${current.name.toLowerCase()} map…` : "Loading the trend map…"}
          <span>The first load can take up to 30 s while NASA data is read. Later loads are instant.</span>
        </div>
      )}

      <div className="leftcol">
      <header className="panel top">
        <h1>TerraTrend</h1>
        <label htmlFor="var">Variable</label>
        <select id="var" value={varId ?? ""} disabled={!vars?.length} onChange={(e) => setVarId(e.target.value)}>
          {vars?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {current && <p className="muted">{current.description}</p>}
        <div className="tabs" role="group" aria-label="Help">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="btn tab"
              aria-pressed={guide === t.id}
              onClick={() => setGuide(guide === t.id ? null : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {guide && (
        <section className="panel guide" aria-label={TABS.find((t) => t.id === guide)?.label}>
          <div className="cf-head">
            <h2>{TABS.find((t) => t.id === guide)?.label}</h2>
            <button className="btn" onClick={() => setGuide(null)} aria-label="Close">
              ✕
            </button>
          </div>
          {guide === "wizard" && vars && <Wizard vars={vars} onDone={(t) => openCase(t)} />}
          {guide === "cases" && <CaseTours onSelect={openCase} />}
          {guide === "glossary" && <Glossary />}
        </section>
      )}
      </div>

      {picked && current && (
        <Suspense fallback={<section className="panel casefile muted">Opening the case file…</section>}>
          <CaseFile variable={current} lat={picked.lat} lon={picked.lon} box={box} onGoto={onGoto} onClose={() => setPicked(null)} />
        </Suspense>
      )}

      <section className="panel legend" aria-label="Legend">
        {error ? (
          <p className="error" role="alert">
            {mapError && current ? `The ${current.name.toLowerCase()} map could not be loaded. ` : ""}
            {error}
          </p>
        ) : loading || !vars ? (
          <p className="muted">Trend legend appears when the map has loaded.</p>
        ) : map ? (
          <>
            <div className="legend-title">
              Trend slope, {map.unit} per decade · {map.period[0]}–{map.period[1]}
            </div>
            <div className="bar" aria-hidden="true" />
            <div className="ticks mono">
              <span>≤ −{limit.toPrecision(2)}</span>
              <span>0</span>
              <span>≥ +{limit.toPrecision(2)}</span>
            </div>
            <p className="muted">
              Faded areas are not significant (FDR q = 0.05). Colour fades out towards zero, so clear areas have
              little or no trend. Soil wetness has no data over the oceans.
            </p>
            <p className="muted small">
              {map.source} · fetched {map.fetched_at}
            </p>
          </>
        ) : null}
      </section>

      <p className="credit">
        Imagery: NASA Blue Marble Next Generation · Stars: three-globe · Borders: Natural Earth
      </p>
    </div>
  );
}
