// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { forwardRef, useEffect, useState } from "react";
import { ApiError } from "./api";
import { geocode, type Place } from "./geocode";
import { IconLocate, IconSearch } from "./icons";

interface Props {
  onPlace: (p: Place) => void;
}

/** "Find my city": type-ahead place search (Open-Meteo geocoding) plus opt-in browser geolocation. */
const CitySearch = forwardRef<HTMLInputElement, Props>(function CitySearch({ onPlace }, ref) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const name = text.trim();
    if (name.length < 2) {
      setFound(null);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      geocode(name, ac.signal)
        .then((r) => {
          setFound(r);
          setActive(0);
          setMsg(null);
        })
        .catch((e) => {
          if (e.name === "AbortError") return;
          setFound(null);
          setMsg(
            e instanceof ApiError
              ? `Place search failed. ${e.detail} Click the globe instead.`
              : "Place search is unavailable right now. Click the globe instead.",
          );
        })
        .finally(() => !ac.signal.aborted && setBusy(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [text]);

  function choose(p: Place) {
    setFound(null);
    setText(p.label.split(",")[0]);
    setMsg(null);
    onPlace(p);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape" && found) {
      e.preventDefault(); // close the results, not the case file
      return setFound(null);
    }
    if (!found?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((active + 1) % found.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((active - 1 + found.length) % found.length);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) return setMsg("This browser cannot share its location.");
    setLocating(true);
    setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onPlace({ label: "Your location", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setMsg(err.code === err.PERMISSION_DENIED ? "Location permission was denied. Search for your city instead." : "Your location could not be found. Search for your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  const open = found !== null && text.trim().length >= 2;

  return (
    <div className="search">
      <form
        className="search-row"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (found?.[active]) choose(found[active]);
        }}
      >
        <label htmlFor="city" className="sr-only">
          Find a city or place
        </label>
        <span className="search-field">
          <IconSearch size={18} />
          <input
            ref={ref}
            id="city"
            type="search"
            autoComplete="off"
            placeholder="Find my city…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            role="combobox"
            aria-expanded={open}
            aria-controls="city-results"
            aria-autocomplete="list"
            aria-activedescendant={open && found?.length ? `city-opt-${active}` : undefined}
          />
          {busy && <span className="spinner sm" aria-hidden="true" />}
        </span>
        <button
          type="button"
          className="btn icon-sq"
          onClick={locate}
          disabled={locating}
          aria-label="Use my location"
          title="Use my location"
        >
          {locating ? <span className="spinner sm" aria-hidden="true" /> : <IconLocate />}
        </button>
      </form>
      {open && (
        <ul id="city-results" className="search-results" role="listbox" aria-label="Places">
          {found.length === 0 ? (
            <li className="muted search-empty">No place found. Try another spelling.</li>
          ) : (
            found.map((p, i) => (
              <li
                key={`${p.lat},${p.lon}`}
                id={`city-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className="search-opt"
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(p)}
              >
                <strong>{p.label.split(",")[0]}</strong>
                <span className="muted small">{p.label.split(",").slice(1).join(",").trim()}</span>
              </li>
            ))
          )}
        </ul>
      )}
      {msg && (
        <p className="error small" role="status">
          {msg}
        </p>
      )}
    </div>
  );
});

export default CitySearch;
