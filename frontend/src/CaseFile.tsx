// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useState } from "react";
import { ApiError, getSeries, getTwin, getWitness, type Series, type Variable, type Witness } from "./api";
import EvidenceChart from "./EvidenceChart";
import VerdictCards from "./VerdictCards";

const errText = (e: unknown) => (e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.");

interface Props {
  variable: Variable;
  lat: number;
  lon: number;
  onClose: () => void;
  onGoto: (lat: number, lon: number) => void;
}

export default function CaseFile({ variable, lat, lon, onClose, onGoto }: Props) {
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [witness, setWitness] = useState<Witness | null>(null);
  const [witnessError, setWitnessError] = useState<string | null>(null);
  const [twinMsg, setTwinMsg] = useState<string | null>(null);
  const [twinBusy, setTwinBusy] = useState(false);
  const id = variable.id;

  useEffect(() => {
    const ac = new AbortController();
    setSeries(null);
    setError(null);
    setWitness(null);
    setWitnessError(null);
    setTwinMsg(null);
    const fail = (set: (m: string) => void) => (e: Error) => e.name !== "AbortError" && set(errText(e));
    getSeries(id, lat, lon, ac.signal).then(setSeries).catch(fail(setError));
    if (variable.has_witness) getWitness(id, lat, lon, ac.signal).then(setWitness).catch(fail(setWitnessError));
    return () => ac.abort();
  }, [id, lat, lon, variable.has_witness]);

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

  return (
    <aside className="panel casefile" aria-label="Case file">
      <div className="cf-head">
        <div>
          <span className="muted">Case file · {variable.name}</span>
          <strong className="mono block">
            {lat.toFixed(2)}°, {lon.toFixed(2)}°
          </strong>
        </div>
        <button className="btn" onClick={onClose} aria-label="Close case file">
          ✕
        </button>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !series ? (
        <p role="status" className="muted">
          Loading evidence…
        </p>
      ) : (
        <>
          <EvidenceChart series={series} unit={variable.unit} />
          <VerdictCards series={series} unit={variable.unit} />
          <p className="muted small">
            {series.source} · fetched {series.fetched_at}
          </p>
        </>
      )}

      {variable.has_witness && (
        <div className="witness" aria-live="polite">
          {witnessError ? (
            <p className="error">{witnessError}</p>
          ) : !witness ? (
            <p className="muted">Checking a second dataset…</p>
          ) : (
            <>
              <span className={`badge ${witness.agrees ? "agree" : "disagree"}`}>
                {witness.agrees ? "ERA5 agrees" : "ERA5 disagrees"}
              </span>
              <p className="muted mono">
                {witness.source}: {witness.sen_per_decade.toFixed(2)} {variable.unit}/decade · NASA POWER:{" "}
                {witness.primary_sen_per_decade.toFixed(2)} {variable.unit}/decade
              </p>
              <p className="muted small">fetched {witness.fetched_at}</p>
            </>
          )}
        </div>
      )}

      <button className="btn wide" onClick={findTwin} disabled={twinBusy}>
        {twinBusy ? "Searching…" : "Fly to the opposite twin"}
      </button>
      {twinMsg && (
        <p className="muted" role="status">
          {twinMsg}
        </p>
      )}
    </aside>
  );
}
