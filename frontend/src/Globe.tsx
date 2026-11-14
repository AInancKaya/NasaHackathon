// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type GlobeGL from "globe.gl";
import type { TrendMap } from "./api";
import { BUMP_URL, EARTH_FALLBACK_URL, EARTH_URL, SKY_URL, linesCanvas } from "./basemap";
import type { Overlay } from "./overlay";
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

  const overlay = useRef<Overlay | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    let ro: ResizeObserver | undefined;
    // globe.gl and three.js are loaded on demand so the page shell paints first
    let stopMeteors: (() => void) | undefined;
    Promise.all([import("globe.gl"), import("three"), import("./overlay"), import("./meteors")]).then(([{ default: Globe }, THREE, ov, met]) => {
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      const g = new Globe(el)
        .backgroundColor(css.getPropertyValue("--bg").trim())
        .backgroundImageUrl(SKY_URL)
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

      // Earth imagery at full sharpness: mipmaps plus the GPU's maximum anisotropic filtering, so the
      // texture stays crisp at grazing angles near the limb instead of smearing.
      const anisotropy = g.renderer().capabilities.getMaxAnisotropy();
      const applyEarth = (tex: InstanceType<typeof THREE.Texture>) => {
        if (disposed) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = anisotropy;
        const mat = g.globeMaterial() as InstanceType<typeof THREE.MeshPhongMaterial>;
        mat.map = tex;
        mat.color.set("#ffffff");
        mat.needsUpdate = true;
      };
      const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
      loader.load(EARTH_URL, applyEarth, undefined, () => loader.load(EARTH_FALLBACK_URL, applyEarth));

      const o = ov.createOverlay(g.getGlobeRadius(), anisotropy);
      g.scene().add(o.mesh);
      overlay.current = o;
      // 8k lines on large screens; 4k on phones keeps GPU memory low
      linesCanvas(el.clientWidth < 768 ? 4096 : 8192).then((c) => !disposed && o.setLines(c));
      stopMeteors = met.startMeteors(THREE, g.scene(), g.camera() as InstanceType<typeof THREE.PerspectiveCamera>);

      ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
      ro.observe(el);
      setReady(true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      stopMeteors?.();
      overlay.current?.dispose();
      overlay.current = null;
      globe.current?._destructor();
      el.replaceChildren();
      globe.current = null;
    };
  }, []);

  useEffect(() => {
    // A null map (another variable is loading, or it failed) clears the overlay, so the previous
    // variable's colours are never shown under the new variable's name.
    const limit = map ? slopeLimit(map) : 0;
    if (map) onLimit(limit);
    overlay.current?.setMap(map, limit);
  }, [map, onLimit, ready]);

  useEffect(() => {
    globe.current?.pointsData(picked ? [picked] : []);
  }, [picked, ready]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, ms = 1500) => globe.current?.pointOfView({ lat, lng: lon, altitude: 1.6 }, ms),
  }));

  return <div ref={host} className="globe" role="img" aria-label="Interactive globe of trend slope per grid cell" />;
});

export default Globe;
