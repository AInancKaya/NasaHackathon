// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef } from "react";
import { IconCompass, IconGlobe, IconSearch } from "./icons";

interface Props {
  period: string | null; // e.g. "1981–2025", from GET /api/variables
  onTour: () => void;
  onCity: () => void;
  onExplore: () => void;
}

/** First-visit overlay: one sentence, the "rises here, falls there" idea, three ways in. */
export default function Intro({ period, onTour, onCity, onExplore }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current!;
    el.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onExplore();
      if (e.key !== "Tab") return;
      // keep focus inside the dialog
      const f = el.querySelectorAll<HTMLElement>("button, a[href]");
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExplore]);

  return (
    <div className="intro-backdrop" onClick={(e) => e.target === e.currentTarget && onExplore()}>
      <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" ref={box}>
        <h2 id="intro-title" className="intro-title">
          <IconGlobe size={26} /> TerraTrend
        </h2>
        <p className="intro-lead">
          Pick any place on Earth and test whether its climate is really changing, with NASA data{period ? ` from ${period}` : ""} and
          the statistics scientists use.
        </p>
        <div className="intro-idea">
          <div className="idea up">
            <span className="idea-dot" aria-hidden="true" />
            <span>
              <strong>Rises here</strong> red places are trending up
            </span>
          </div>
          <div className="idea down">
            <span className="idea-dot" aria-hidden="true" />
            <span>
              <strong>Falls there</strong> blue places are trending down
            </span>
          </div>
          <p className="muted">
            Change is not the same everywhere. Every case file can fly you to its opposite twin, and faded colour means
            the trend is not yet significant.
          </p>
        </div>
        <div className="intro-actions">
          <button className="btn primary" onClick={onTour}>
            <IconCompass /> Take a case tour
          </button>
          <button className="btn" onClick={onCity}>
            <IconSearch /> Find my city
          </button>
          <button className="btn ghost" onClick={onExplore}>
            Explore freely
          </button>
        </div>
      </div>
    </div>
  );
}
