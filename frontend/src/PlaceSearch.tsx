// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef, useState } from "react";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

// Place search uses the free, no-login Open-Meteo geocoding API (only the typed text is sent).
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

export async function geocode(name: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${GEOCODE}?name=${encodeURIComponent(name)}&count=6&language=en&format=json`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  return (body.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

/** Top-bar city search: type, pick a result, and the globe flies there and opens its case file. */
export default function PlaceSearch({ onSelect }: { onSelect: (p: Place) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Search as the user types, debounced so one request goes out per pause.
  useEffect(() => {
    const name = text.trim();
    if (name.length < 2) {
      setFound(null);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      geocode(name, ac.signal)
        .then((r) => {
          setFound(r);
          setError(false);
          setActive(0);
        })
        .catch((e) => e.name !== "AbortError" && (setFound(null), setError(true)));
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [text]);

  useEffect(() => {
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const choose = (p: Place) => {
    onSelect(p);
    setText(p.label.split(",")[0]);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOpen(false);
    if (!found?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % found.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + found.length) % found.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(found[active]);
    }
  };

  const showList = open && text.trim().length >= 2 && (error || found !== null);
  return (
    <div className="place-search" ref={box}>
      <svg className="ps-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        role="combobox"
        aria-label="Search for a city"
        aria-expanded={showList}
        aria-controls="ps-list"
        aria-activedescendant={showList && found?.length ? `ps-${active}` : undefined}
        placeholder="Search a city…"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {showList && (
        <ul id="ps-list" className="ps-list" role="listbox">
          {error && <li className="ps-note error">Place search is unavailable right now.</li>}
          {found?.length === 0 && <li className="ps-note muted">No place found. Try another spelling.</li>}
          {found?.map((p, i) => (
            <li
              key={`${p.lat},${p.lon}`}
              id={`ps-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(p)}
            >
              <span>{p.label.split(",")[0]}</span>
              <span className="muted">{p.label.split(",").slice(1).join(",").trim()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
