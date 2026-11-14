// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type GlobeGL from "globe.gl";
import type { TrendMap } from "./api";
import { BASE_URL, BUMP_URL, compose, loadBasemap, type Basemap } from "./basemap";
import { slopeLimit } from "./scale";

export interface GlobeHandle {
  /** Fly the camera to a point (used by S4 for the opposite-twin flight). */
  flyTo: (lat: number, lon: number, ms?: number) => void;
}

interface Props {
  map: TrendMap | null;
  picked: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  onLimit: (limit: number) => void;
}

type GlobeInstance = InstanceType<typeof GlobeGL>;

const Globe = forwardRef<GlobeHandle, Props>(function Globe({ map, picked, onPick, onLimit }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<Basemap | null>(null);

  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    let ro: ResizeObserver | undefined;
    loadBasemap().then((b) => !disposed && setBasemap(b));
    // globe.gl (three.js) is loaded on demand so the page shell paints first
    import("globe.gl").then(({ default: Globe }) => {
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const g = new Globe(el)
        .backgroundColor(css.getPropertyValue("--bg").trim())
        .globeImageUrl(BASE_URL) // the Earth is visible at once; the trend overlay is composited in later
        .bumpImageUrl(BUMP_URL)
        .atmosphereColor(css.getPropertyValue("--accent").trim())
        .atmosphereAltitude(0.18)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .pointRadius(1.2)
        .pointAltitude(0.02)
        .pointColor(() => css.getPropertyValue("--accent").trim())
        .onGlobeClick(({ lat, lng }) => onPickRef.current(lat, lng));
      g.pointOfView({ altitude: el.clientWidth < 600 ? 3.4 : 2.5 });
      g.controls().autoRotate = false;
      globe.current = g;
      ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
      ro.observe(el);
      setReady(true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      globe.current?._destructor();
      el.replaceChildren();
      globe.current = null;
    };
  }, []);

  useEffect(() => {
    const g = globe.current;
    if (!g || !basemap) return;
    let cancelled = false;
    const limit = map ? slopeLimit(map) : 0;
    if (map) onLimit(limit);
    const alpha = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--overlay-alpha"));
    compose(basemap, map, limit, alpha).then((blob) => {
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      g.globeImageUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 10_000); // by then the texture has been decoded
    });
    return () => {
      cancelled = true;
    };
  }, [map, onLimit, ready, basemap]);

  useEffect(() => {
    globe.current?.pointsData(picked ? [picked] : []);
  }, [picked, ready]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, ms = 1500) => globe.current?.pointOfView({ lat, lng: lon, altitude: 1.6 }, ms),
  }));

  return <div ref={host} className="globe" role="img" aria-label="Interactive globe of trend slope per grid cell" />;
});

export default Globe;
