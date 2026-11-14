// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getTrendMap, getVariables, type TrendMap, type Variable } from "./api";
import CaseTours from "./CaseTours";
import Glossary from "./Glossary";
import Wizard from "./Wizard";
import "./guide.css";
import Globe, { type GlobeHandle } from "./Globe";
import PlaceSearch from "./PlaceSearch";

// The case file pulls in Plotly (a few MB): load it only when someone opens a case.
const CaseFile = lazy(() => import("./CaseFile"));

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.";
}

type GuideTab = "layers" | "wizard" | "cases" | "glossary";
// Icon paths are simple 24x24 strokes drawn for this app.
const TABS: { id: GuideTab; label: string; title: string; icon: string }[] = [
  { id: "layers", label: "Layers", title: "Data layer", icon: "M12 3 2 8l10 5 10-5-10-5ZM2 13l10 5 10-5M2 18l10 5 10-5" },
  { id: "wizard", label: "Guide", title: "Guide me", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4 6-2.5 5.5L8 16l2.5-5.5L16 8Z" },
  { id: "cases", label: "Cases", title: "Case tours", icon: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" },
  { id: "glossary", label: "Glossary", title: "Glossary", icon: "M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17ZM4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" },
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
  // The data-layer drawer starts open on wide screens, closed on phones so the globe stays visible.
  const [guide, setGuide] = useState<GuideTab | null>(() => (window.innerWidth > 900 ? "layers" : null));

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
    <div className={guide ? "app drawer-open" : "app"}>
      <Globe ref={globe} map={map} picked={picked} onPick={onPick} onLimit={setLimit} />

      <header className="topbar">
        <h1 className="brand">AeroVestige</h1>
        <PlaceSearch onSelect={(p) => onGoto(p.lat, p.lon)} />
      </header>

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

      <nav className="rail" aria-label="Tools">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="rail-btn"
            aria-pressed={guide === t.id}
            title={t.title}
            onClick={() => setGuide(guide === t.id ? null : t.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {guide && (
        <section className="panel drawer" aria-label={TABS.find((t) => t.id === guide)?.title}>
          <div className="cf-head">
            <h2>{TABS.find((t) => t.id === guide)?.title}</h2>
            <button className="btn icon" onClick={() => setGuide(null)} aria-label="Close">
              ✕
            </button>
          </div>
          {guide === "layers" && (
            <div className="layers" role="radiogroup" aria-label="Variable">
              {vars?.map((v) => (
                <button
                  key={v.id}
                  role="radio"
                  aria-checked={v.id === varId}
                  className="layer"
                  onClick={() => setVarId(v.id)}
                >
                  <span className="layer-name">{v.name}</span>
                  <span className="layer-unit mono">{v.unit}</span>
                  {v.id === varId && <span className="layer-desc">{v.description}</span>}
                </button>
              ))}
              {!vars && !varsError && <p className="muted">Loading variables…</p>}
            </div>
          )}
          {guide === "wizard" && vars && <Wizard vars={vars} onDone={(t) => openCase(t)} />}
          {guide === "cases" && <CaseTours onSelect={openCase} />}
          {guide === "glossary" && <Glossary />}
        </section>
      )}

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
              <strong>{current?.name}</strong> · trend slope, {map.unit} per decade · {map.period[0]}–{map.period[1]}
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
