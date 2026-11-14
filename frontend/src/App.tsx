// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getCases, getTrendMap, getVariables, type Case, type TrendMap, type Variable } from "./api";
import CaseTours, { TourBar, type CaseTarget } from "./CaseTours";
import CitySearch from "./CitySearch";
import Glossary from "./Glossary";
import { IconBook, IconCompass, IconFlask, IconGlobe, IconInfo, IconClose } from "./icons";
import Intro from "./Intro";
import Legend from "./Legend";
import Method from "./Method";
import { PlaceName } from "./placeName";
import VarPicker from "./VarPicker";
import Wizard from "./Wizard";
import "./guide.css";
import "./ui.css";
import Globe, { type GlobeHandle } from "./Globe";
import { placeAt } from "./geocode";
import { paletteFor } from "./scale";

// The case file pulls in Plotly (about 1 MB): load it only when someone opens a case.
const CaseFile = lazy(() => import("./CaseFile"));

function errText(e: unknown): string {
  return e instanceof ApiError ? `${e.error}: ${e.detail}` : "Unexpected error.";
}

type GuideTab = "wizard" | "cases" | "glossary" | "method";
// `short` is the rail label under the icon; `label` titles the drawer.
const TABS: { id: GuideTab; label: string; short: string; icon: JSX.Element }[] = [
  { id: "cases", label: "Case tours", short: "Tours", icon: <IconCompass size={22} /> },
  { id: "wizard", label: "Guide me", short: "Guide", icon: <IconInfo size={22} /> },
  { id: "glossary", label: "Glossary", short: "Glossary", icon: <IconBook size={22} /> },
  { id: "method", label: "Method", short: "Method", icon: <IconFlask size={22} /> },
];

const INTRO_KEY = "terravestige.intro.seen";
function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}
function rememberIntro() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* private mode: show it again next time */
  }
}

/** ?var=&lat=&lon=(&box=) from a shared case link; ignored unless every value is valid. */
function readDeepLink(): { varId: string | null; lat?: number; lon?: number; box: number | null } | null {
  const q = new URLSearchParams(location.search);
  const varId = q.get("var");
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const box = Number(q.get("box"));
  const hasPoint = q.has("lat") && q.has("lon") && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  if (!varId && !hasPoint) return null;
  return {
    varId,
    ...(hasPoint ? { lat, lon } : {}),
    box: q.has("box") && box > 0 && box <= 10 ? box : null,
  };
}

export default function App() {
  const globe = useRef<GlobeHandle>(null);
  const search = useRef<HTMLInputElement>(null);
  const link = useRef(readDeepLink());
  const pendingFly = useRef<{ lat: number; lon: number } | null>(
    link.current?.lat !== undefined ? { lat: link.current.lat, lon: link.current.lon! } : null,
  );
  const [vars, setVars] = useState<Variable[] | null>(null);
  const [varsError, setVarsError] = useState<string | null>(null);
  const [varId, setVarId] = useState<string | null>(null);
  const [map, setMap] = useState<TrendMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [everLoaded, setEverLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [limit, setLimit] = useState(0);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(
    link.current?.lat !== undefined ? { lat: link.current.lat, lon: link.current.lon! } : null,
  );
  const [place, setPlace] = useState<string | null>(null);
  const [clickedName, setClickedName] = useState<string | null>(null);
  const [box, setBox] = useState<number | null>(link.current?.box ?? null);
  const [guide, setGuide] = useState<GuideTab | null>(null);
  const [cases, setCases] = useState<Case[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [tour, setTour] = useState<number | null>(null);
  const [intro, setIntro] = useState(() => link.current?.lat === undefined && !introSeen());

  useEffect(() => {
    const ac = new AbortController();
    getVariables(ac.signal)
      .then((all) => {
        const withMap = all.filter((v) => v.has_map);
        setVars(withMap);
        const wanted = link.current?.varId;
        setVarId((cur) => cur ?? (withMap.find((v) => v.id === wanted) ?? withMap[0])?.id ?? null);
      })
      .catch((e) => e.name !== "AbortError" && setVarsError(errText(e)));
    getCases(ac.signal)
      .then(setCases)
      .catch((e) => e.name !== "AbortError" && setCasesError(errText(e)));
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
        setEverLoaded(true);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setMapError(errText(e));
        setLoading(false);
      });
    return () => ac.abort();
  }, [varId]);

  // A deep link flies the globe once it exists; the globe is created asynchronously, so try again shortly after.
  useEffect(() => {
    const p = pendingFly.current;
    if (!map || !p) return;
    globe.current?.flyTo(p.lat, p.lon);
    const t = setTimeout(() => globe.current?.flyTo(p.lat, p.lon), 900);
    pendingFly.current = null;
    return () => clearTimeout(t);
  }, [map]);

  // Keep the address bar on the open case, so it can be copied or bookmarked at any time.
  useEffect(() => {
    if (!varId) return;
    const q = new URLSearchParams({ var: varId });
    if (picked) {
      q.set("lat", picked.lat.toFixed(2));
      q.set("lon", picked.lon.toFixed(2));
      if (box) q.set("box", String(box));
    }
    history.replaceState(null, "", `${location.pathname}?${q}`);
  }, [varId, picked, box]);

  const onPick = useCallback((lat: number, lon: number) => {
    if (window.matchMedia("(max-width: 600px)").matches) setGuide(null); // one bottom sheet at a time
    setBox(null);
    setPlace(null);
    setPicked({ lat, lon });
  }, []);
  const onGoto = useCallback((lat: number, lon: number) => {
    globe.current?.flyTo(lat, lon);
    setBox(null);
    setPlace(null);
    setPicked({ lat, lon });
  }, []);
  const openCase = useCallback((t: CaseTarget | { varId: string; lat: number; lon: number; box?: number | null }) => {
    setVarId(t.varId);
    setGuide(null);
    globe.current?.flyTo(t.lat, t.lon);
    setBox(t.box ?? null);
    setPlace(null);
    setPicked({ lat: t.lat, lon: t.lon });
  }, []);

  const goTour = useCallback(
    (i: number) => {
      if (!cases?.[i]) return;
      const c = cases[i];
      setTour(i);
      openCase({ varId: c.var, lat: c.lat, lon: c.lon, box: c.box });
    },
    [cases, openCase],
  );

  const closeIntro = useCallback(() => {
    rememberIntro();
    setIntro(false);
  }, []);

  // A clicked point has no name yet: look up the nearest city and country for the marker and case file.
  useEffect(() => {
    setClickedName(null);
    if (!picked || place) return;
    const ac = new AbortController();
    placeAt(picked.lat, picked.lon, ac.signal)
      .then(setClickedName)
      .catch(() => {});
    return () => ac.abort();
  }, [picked, place]);
  const placeLabel = place ?? clickedName;

  // Set before the map arrives, so the overlay and legend read the right colour scale.
  useEffect(() => {
    document.documentElement.dataset.palette = paletteFor(varId);
  }, [varId]);

  const current = vars?.find((v) => v.id === varId);
  // The old map is still in state for one render after a switch: treat that as loading too.
  const mapLoading = loading || (!!map && map.var !== varId);
  const error = varsError ?? (mapError && current ? `The ${current.name.toLowerCase()} map could not be loaded. ${mapError}` : mapError);
  const period = vars?.[0] ? `${vars[0].start_year}–${vars[0].end_year}` : null;

  return (
    <div className={`app${tour !== null ? " touring" : ""}${picked ? " has-case" : ""}${guide ? " guide-open" : ""}`}>
      <Globe ref={globe} map={map} picked={picked} label={placeLabel} onPick={onPick} onLimit={setLimit} />

      {!everLoaded && !error && (
        <div className="loading" role="status">
          <div className="spinner" aria-hidden="true" />
          {current ? `Loading the ${current.name.toLowerCase()} map…` : "Loading the trend map…"}
          <span>The first load can take up to 30 s while NASA data is read. Later loads are instant.</span>
        </div>
      )}

      <header className="topbar">
        <div className="brand">
          <h1>
            <IconGlobe size={20} /> TerraVestige
          </h1>
          <button className="btn icon ghost" onClick={() => setIntro(true)} aria-label="About TerraVestige" title="About">
            <IconInfo size={18} />
          </button>
        </div>
        <CitySearch
          ref={search}
          onPlace={(p) => {
            openCase({ varId: varId ?? "", lat: p.lat, lon: p.lon });
            setPlace(p.label);
          }}
        />
      </header>

      <div className="leftcol">
        <div className="panel top">
          <VarPicker vars={vars} value={varId} loading={mapLoading} onChange={setVarId} />
        </div>
        <nav className="rail" aria-label="Help and tours">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="rail-btn"
              aria-pressed={guide === t.id}
              title={t.label}
              onClick={() => setGuide(guide === t.id ? null : t.id)}
            >
              {t.icon}
              <span>{t.short}</span>
            </button>
          ))}
        </nav>

        {tour !== null && cases && (
          <TourBar cases={cases} index={tour} onGo={goTour} onExit={() => setTour(null)} />
        )}

        {guide && (
          <section className="panel guide" aria-label={TABS.find((t) => t.id === guide)?.label}>
            <div className="sheet-grip" aria-hidden="true" />
            <div className="guide-head">
              <h2>{TABS.find((t) => t.id === guide)?.label}</h2>
              <button className="btn icon" onClick={() => setGuide(null)} aria-label="Close">
                <IconClose size={18} />
              </button>
            </div>
            {guide === "wizard" && vars && <Wizard vars={vars} onDone={(t) => openCase(t)} />}
            {guide === "cases" && (
              <CaseTours
                cases={cases}
                error={casesError}
                onStart={(i) => {
                  setGuide(null);
                  goTour(i);
                }}
              />
            )}
            {guide === "glossary" && <Glossary />}
            {guide === "method" && <Method />}
          </section>
        )}
      </div>

      {picked && current && (
        <Suspense fallback={<section className="panel casefile muted">Opening the case file…</section>}>
          <PlaceName.Provider value={placeLabel}>
            <CaseFile
              variable={current}
              lat={picked.lat}
              lon={picked.lon}
              box={box}
              onGoto={onGoto}
              onClose={() => setPicked(null)}
            />
          </PlaceName.Provider>
        </Suspense>
      )}

      <Legend
        variable={current}
        map={map}
        limit={limit}
        loading={mapLoading || !vars}
        error={error}
        onMethod={() => setGuide("method")}
      />

      <p className="credit">
        Imagery: NASA Blue Marble Next Generation · Stars: three-globe · Borders: Natural Earth
      </p>

      {intro && (
        <Intro
          period={period}
          onExplore={closeIntro}
          onCity={() => {
            closeIntro();
            setTimeout(() => search.current?.focus(), 0);
          }}
          onTour={() => {
            closeIntro();
            if (cases?.length) goTour(0);
            else setGuide("cases");
          }}
        />
      )}
    </div>
  );
}
