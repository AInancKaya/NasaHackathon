// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { Case } from "./api";
import { IconChevron, IconClose } from "./icons";

export interface CaseTarget {
  varId: string;
  lat: number;
  lon: number;
  box: number | null;
}

interface ListProps {
  cases: Case[] | null;
  error: string | null;
  onStart: (index: number) => void;
}

/** Curated tours. Only place, variable and citation come from /api/cases; every number is computed live. */
export default function CaseTours({ cases, error, onStart }: ListProps) {
  if (error) return <p className="error" role="alert">{error}</p>;
  if (!cases) return <p role="status" className="muted">Loading cases…</p>;

  return (
    <>
      <p className="muted">
        {cases.length} short investigations. Each one flies the globe to the place and runs the statistics live.
      </p>
      <button className="btn wide primary" onClick={() => onStart(0)}>
        Start the tour
      </button>
      <ol className="list tours">
        {cases.map((c, i) => (
          <li key={c.id}>
            <button className="tour" onClick={() => onStart(i)}>
              <span className="tour-n mono" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{c.title}</strong>
                <span className="muted">{c.question}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

interface BarProps {
  cases: Case[];
  index: number;
  onGo: (index: number) => void;
  onExit: () => void;
}

/** Step-through bar shown while a tour is running: "Case 2 of 5", previous / next, exit. */
export function TourBar({ cases, index, onGo, onExit }: BarProps) {
  const c = cases[index];
  const last = index === cases.length - 1;
  return (
    <section className="tourbar" aria-label="Case tour" aria-live="polite">
      <div className="tourbar-head">
        <span className="tourbar-step">
          Case {index + 1} of {cases.length}
        </span>
        <button className="btn icon" onClick={onExit} aria-label="End the tour">
          <IconClose size={18} />
        </button>
      </div>
      <h2 className="tourbar-title">{c.title}</h2>
      <p className="tourbar-q">{c.question}</p>
      <p className="muted small tourbar-cite">
        Background:{" "}
        <a href={c.citation_url} target="_blank" rel="noopener noreferrer">
          {c.citation}
        </a>
      </p>
      <div className="tourbar-nav">
        <button className="btn" onClick={() => onGo(index - 1)} disabled={index === 0}>
          <IconChevron dir="left" size={18} /> Previous
        </button>
        <div className="tourbar-dots" aria-hidden="true">
          {cases.map((x, i) => (
            <i key={x.id} className={i === index ? "on" : ""} />
          ))}
        </div>
        {last ? (
          <button className="btn primary" onClick={onExit}>
            Finish
          </button>
        ) : (
          <button className="btn primary" onClick={() => onGo(index + 1)}>
            Next <IconChevron dir="right" size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
