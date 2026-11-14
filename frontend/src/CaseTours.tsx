// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useState } from "react";
import { ApiError, getCases, type Case } from "./api";

export interface CaseTarget {
  varId: string;
  lat: number;
  lon: number;
  box: number | null;
}

interface Props {
  onSelect: (t: CaseTarget) => void;
}

/** Curated tours. Only place, variable and citation come from /api/cases; every number is computed live. */
export default function CaseTours({ onSelect }: Props) {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    getCases(ac.signal)
      .then(setCases)
      .catch((e) => e.name !== "AbortError" && setError(e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error."));
    return () => ac.abort();
  }, []);

  if (error) return <p className="error" role="alert">{error}</p>;
  if (!cases) return <p role="status" className="muted">Loading cases…</p>;

  return (
    <ul className="list tours">
      {cases.map((c) => (
        <li key={c.id} className="tour">
          <h3>{c.title}</h3>
          <p>{c.question}</p>
          <button className="btn wide" onClick={() => onSelect({ varId: c.var, lat: c.lat, lon: c.lon, box: c.box })}>
            Investigate
          </button>
          <p className="muted small">
            Background:{" "}
            <a href={c.citation_url} target="_blank" rel="noopener noreferrer">
              {c.citation}
            </a>
          </p>
        </li>
      ))}
    </ul>
  );
}
