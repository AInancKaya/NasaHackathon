// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getTrendMap, getVariables, type TrendMap, type Variable } from "./api";
import Globe, { type GlobeHandle } from "./Globe";

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.";
}

export default function App() {
  const globe = useRef<GlobeHandle>(null); // S4 will call globe.current.flyTo(lat, lon)
  const [vars, setVars] = useState<Variable[] | null>(null);
  const [varsError, setVarsError] = useState<string | null>(null);
  const [varId, setVarId] = useState<string | null>(null);
  const [map, setMap] = useState<TrendMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [limit, setLimit] = useState(0);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

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

  const onPick = useCallback((lat: number, lon: number) => setPicked({ lat, lon }), []);
  const current = vars?.find((v) => v.id === varId);
  const error = varsError ?? mapError;

  return (
    <div className="app">
      <Globe ref={globe} map={map} picked={picked} onPick={onPick} onLimit={setLimit} />

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
      </header>

      {picked && (
        <aside className="panel pick" aria-live="polite">
          <span className="muted">Selected point</span>
          <strong className="mono">
            {picked.lat.toFixed(2)}°, {picked.lon.toFixed(2)}°
          </strong>
        </aside>
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
