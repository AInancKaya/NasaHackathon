// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useState } from "react";
import type { Variable } from "./api";
import { geocode, type Place } from "./geocode";

export interface Target {
  varId: string;
  lat: number;
  lon: number;
}

// Preset places: coordinates are map locations, not results. All numbers shown later are live.
const PRESETS: Place[] = [
  { label: "London", lat: 51.51, lon: -0.13 },
  { label: "New York", lat: 40.71, lon: -74.01 },
  { label: "Istanbul", lat: 41.01, lon: 28.95 },
  { label: "Cairo", lat: 30.04, lon: 31.24 },
  { label: "Delhi", lat: 28.61, lon: 77.21 },
  { label: "Lagos", lat: 6.52, lon: 3.38 },
  { label: "São Paulo", lat: -23.55, lon: -46.63 },
  { label: "Sydney", lat: -33.87, lon: 151.21 },
];

type Interest = "temp" | "water" | "air";
type Kind = "city" | "farm" | "coast" | "mountain" | "dry";

const INTERESTS: { id: Interest; label: string }[] = [
  { id: "temp", label: "Is it getting hotter?" },
  { id: "water", label: "Is rain or water changing?" },
  { id: "air", label: "What about wind and humidity?" },
];

const KINDS: { id: Kind; label: string }[] = [
  { id: "city", label: "A big city" },
  { id: "farm", label: "Farmland" },
  { id: "coast", label: "The coast" },
  { id: "mountain", label: "Mountains or polar regions" },
  { id: "dry", label: "A dry region" },
];

// Variable ids from GET /api/variables, with the reason a student would care.
const PICK: Record<Interest, Record<Kind, [string, string]>> = {
  temp: {
    city: ["t2m_min", "Warmer nights are what people feel first. This is the regional trend around the city; the data is too coarse to show the city's own heat island."],
    farm: ["t2m_max", "Crops suffer most on the hottest afternoons."],
    coast: ["t2m", "Average air temperature is the clearest signal of a warming coast."],
    mountain: ["t2m", "Cold regions are where average warming is most visible."],
    dry: ["t2m_max", "Daytime heat is what makes dry regions hard to live in."],
  },
  water: {
    city: ["prectotcorr", "Rainfall decides flood and water-supply risk for a city."],
    farm: ["gwettop", "Soil wetness shows drought stress on crops directly."],
    coast: ["tqv", "Water vapour in the air feeds coastal storms and heavy rain."],
    mountain: ["prectotcorr", "Rain and snowfall fill the rivers below."],
    dry: ["prectotcorr", "In dry places, small changes in rainfall matter a lot."],
  },
  air: {
    city: ["rh2m", "Humidity changes how hot a day feels."],
    farm: ["rh2m", "Dry air speeds up evaporation from soil and plants."],
    coast: ["ws10m", "Wind shapes storms, waves, and wind-power potential."],
    mountain: ["ws10m", "Wind strongly shapes mountain weather."],
    dry: ["rh2m", "Very dry air raises wildfire danger."],
  },
};

interface Props {
  vars: Variable[];
  onDone: (t: Target) => void;
}

export default function Wizard({ vars, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [text, setText] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const name = text.trim();
    if (!name) return;
    setSearching(true);
    setSearchError(null);
    try {
      setFound(await geocode(name));
    } catch {
      setFound(null);
      setSearchError("Place search is unavailable right now. Pick one of the preset places instead.");
    }
    setSearching(false);
  }

  const choose = (p: Place) => {
    setPlace(p);
    setStep(2);
  };

  if (step === 0) {
    return (
      <div className="wiz">
        <h2>1 of 3 · What are you curious about?</h2>
        <div className="opts">
          {INTERESTS.map((o) => (
            <button
              key={o.id}
              className="btn opt"
              onClick={() => {
                setInterest(o.id);
                setStep(1);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="wiz">
        <h2>2 of 3 · Where?</h2>
        <form className="search" onSubmit={search}>
          <label htmlFor="wiz-place">Search for a city or place</label>
          <div className="row">
            <input id="wiz-place" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Ankara" />
            <button className="btn" type="submit" disabled={searching || !text.trim()}>
              {searching ? "…" : "Search"}
            </button>
          </div>
        </form>
        {searchError && <p className="error">{searchError}</p>}
        {found && found.length === 0 && <p className="muted">No place found. Try another spelling.</p>}
        {found && found.length > 0 && (
          <ul className="list" aria-label="Search results">
            {found.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
                <button className="btn opt" onClick={() => choose(p)}>
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">Or pick a preset:</p>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.label} className="btn chip" onClick={() => choose(p)}>
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn link" onClick={() => setStep(0)}>
          ← Back
        </button>
      </div>
    );
  }

  if (step === 2 || !interest || !place || !kind) {
    return (
      <div className="wiz">
        <h2>3 of 3 · What kind of place?</h2>
        <p className="muted">{place?.label}</p>
        <div className="opts">
          {KINDS.map((o) => (
            <button
              key={o.id}
              className="btn opt"
              onClick={() => {
                setKind(o.id);
                setStep(3);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button className="btn link" onClick={() => setStep(1)}>
          ← Back
        </button>
      </div>
    );
  }

  const [varId, why] = PICK[interest][kind];
  const v = vars.find((x) => x.id === varId);
  return (
    <div className="wiz">
      <h2>Your case</h2>
      {v ? (
        <>
          <p>
            Investigate <strong>{v.name.toLowerCase()}</strong> near <strong>{place.label}</strong>.
          </p>
          <p className="muted">{why}</p>
          <button className="btn wide" onClick={() => onDone({ varId, lat: place.lat, lon: place.lon })}>
            Open the case file
          </button>
        </>
      ) : (
        <p className="error" role="alert">
          The variable “{varId}” is not available from the API.
        </p>
      )}
      <button className="btn link" onClick={() => setStep(2)}>
        ← Back
      </button>
    </div>
  );
}
