// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import GlobeGL from "globe.gl";
import type { TrendMap } from "./api";
import { renderTexture, slopeLimit } from "./scale";

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

  useEffect(() => {
    const el = host.current!;
    const css = getComputedStyle(document.documentElement);
    const g = new GlobeGL(el)
      .backgroundColor(css.getPropertyValue("--bg").trim())
      .atmosphereColor(css.getPropertyValue("--accent").trim())
      .atmosphereAltitude(0.18)
      .width(el.clientWidth)
      .height(el.clientHeight)
      .pointRadius(1.2)
      .pointAltitude(0.02)
      .pointColor(() => css.getPropertyValue("--accent").trim())
      .onGlobeClick(({ lat, lng }) => onPickRef.current(lat, lng));
    const mat = g.globeMaterial();
    mat.color.set(css.getPropertyValue("--surface-solid").trim());
    mat.transparent = true; // honour texture alpha: faded and null cells show the dark space behind
    g.pointOfView({ altitude: el.clientWidth < 600 ? 3.4 : 2.5 });
    g.controls().autoRotate = false;
    globe.current = g;
    const ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      g._destructor();
      el.replaceChildren();
      globe.current = null;
    };
  }, []);

  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    if (!map) {
      g.globeImageUrl("");
      return;
    }
    const limit = slopeLimit(map);
    onLimit(limit);
    g.globeImageUrl(renderTexture(map, limit).toDataURL());
  }, [map, onLimit]);

  useEffect(() => {
    globe.current?.pointsData(picked ? [picked] : []);
  }, [picked]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, ms = 1500) => globe.current?.pointOfView({ lat, lng: lon, altitude: 1.6 }, ms),
  }));

  return <div ref={host} className="globe" role="img" aria-label="Interactive globe of trend slope per grid cell" />;
});

export default Globe;
