// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getTrendMap, getVariables, type TrendMap, type Variable } from "./api";
import CaseFile from "./CaseFile";
import CaseTours from "./CaseTours";
import Glossary from "./Glossary";
import Wizard from "./Wizard";
import "./guide.css";
import Globe, { type GlobeHandle } from "./Globe";

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
        <CaseFile variable={current} lat={picked.lat} lon={picked.lon} box={box} onGoto={onGoto} onClose={() => setPicked(null)} />
      )}

      <section className="panel legend" aria-label="Legend">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : loading || !vars ? (
          <p role="status" className="muted">
            Loading trend map… the first request for a variable can take about 30 s while data is read.
          </p>
        ) : map ? (
          <>
            <div className="legend-title">
              Trend slope, {map.unit} per decade · {map.period[0]}–{map.period[1]}
            </div>
            <div className="bar" aria-hidden="true" />
            <div className="ticks mono">
              <span>−{limit.toPrecision(2)}</span>
              <span>0</span>
              <span>+{limit.toPrecision(2)}</span>
            </div>
            <p className="muted">Faded cells are not significant (FDR q = 0.05). Blank cells have no data.</p>
            <p className="muted small">
              {map.source} · fetched {map.fetched_at}
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
