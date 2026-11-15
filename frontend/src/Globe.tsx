// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type GlobeGL from "globe.gl";
import type { TrendMap } from "./api";
import { BUMP_URL, EARTH_FALLBACK_URL, EARTH_URL, WATER_URL, linesCanvas } from "./basemap";
import type { Overlay } from "./overlay";
import { slopeLimit } from "./scale";

export interface GlobeHandle {
  /** Fly the camera to a point (used by S4 for the opposite-twin flight). */
  flyTo: (lat: number, lon: number, ms?: number) => void;
}

interface Props {
  map: TrendMap | null;
  picked: { lat: number; lon: number } | null;
  /** "City, Country" for the picked point, shown on its marker; null while unknown (coordinates only). */
  label: string | null;
  onPick: (lat: number, lon: number) => void;
  onLimit: (limit: number) => void;
}

type GlobeInstance = InstanceType<typeof GlobeGL>;

const IDLE_MS = 6000; // auto-rotate after this long without interaction
const SKY_RADIUS = 40000; // beyond the furthest zoom (100 globe radii), inside the camera's far plane

const Globe = forwardRef<GlobeHandle, Props>(function Globe({ map, picked, label, onPick, onLimit }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const overlay = useRef<Overlay | null>(null);
  const [ready, setReady] = useState(false);
  const idle = useRef<number>();
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const stopRotateRef = useRef(() => {});
  const scheduleRotateRef = useRef(() => {});

  useEffect(() => {
    const el = host.current!;
    let disposed = false;
    let ro: ResizeObserver | undefined;
    let stopMeteors: (() => void) | undefined;
    // globe.gl and three.js are loaded on demand so the page shell paints first
    Promise.all([import("globe.gl"), import("three"), import("./overlay"), import("./stars"), import("./meteors")]).then(
      ([{ default: Globe }, THREE, ov, st, met]) => {
      if (disposed) return;
      const css = getComputedStyle(document.documentElement);
      // The sun: a directional light kept up and to the left of the camera, so relief and ocean glint
      // read from every viewpoint; a softer ambient keeps the night side legible.
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      const g = new Globe(el)
        .backgroundColor("#000003")
        .lights([new THREE.AmbientLight(0xffffff, 1.9), sun])
        .bumpImageUrl(BUMP_URL)
        .atmosphereColor("#6aaeff")
        .atmosphereAltitude(0.16)
        .width(el.clientWidth)
        .height(el.clientHeight)
        .pointRadius(1.2)
        .pointAltitude(0.02)
        .pointColor(() => css.getPropertyValue("--accent").trim())
        .onGlobeClick(({ lat, lng }) => onPickRef.current(lat, lng))
        .htmlLng((d) => (d as { lon: number }).lon)
        .htmlAltitude(0.005)
        .htmlTransitionDuration(0)
        .htmlElement((d) => (d as { el: HTMLElement }).el);
      g.pointOfView({ altitude: el.clientWidth < 600 ? 3.4 : 2.5 });
      globe.current = g;

      const camera = g.camera();
      const controls = g.controls();
      const placeSun = () => {
        sun.position.copy(camera.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
        sun.position.y += camera.position.length() * 0.35;
      };
      placeSun();
      controls.addEventListener("change", placeSun);

      // Idle auto-rotate: starts after IDLE_MS without input, stops as soon as the user touches the globe.
      controls.autoRotateSpeed = 0.35;
      const stopRotate = () => {
        controls.autoRotate = false;
        clearTimeout(idle.current);
      };
      const scheduleRotate = () => {
        clearTimeout(idle.current);
        idle.current = window.setTimeout(() => (controls.autoRotate = !pickedRef.current), IDLE_MS);
      };
      stopRotateRef.current = stopRotate;
      scheduleRotateRef.current = scheduleRotate;
      controls.addEventListener("start", stopRotate);
      controls.addEventListener("end", scheduleRotate);
      scheduleRotate();

      // Earth imagery at full sharpness: mipmaps plus the GPU's maximum anisotropic filtering, so the
      // texture stays crisp at grazing angles near the limb instead of smearing.
      const renderer = g.renderer();
      const anisotropy = renderer.capabilities.getMaxAnisotropy();
      const mat = g.globeMaterial() as InstanceType<typeof THREE.MeshPhongMaterial>;
      mat.bumpScale = 4;
      mat.shininess = 40;
      mat.specular = new THREE.Color("#3c4a5c");
      const applyEarth = (tex: InstanceType<typeof THREE.Texture>) => {
        if (disposed) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = anisotropy;
        mat.map = tex;
        mat.color.set("#ffffff");
        mat.needsUpdate = true;
      };
      const loader = new THREE.TextureLoader().setCrossOrigin("anonymous");
      loader.load(EARTH_URL, applyEarth, undefined, () => loader.load(EARTH_FALLBACK_URL, applyEarth));
      loader.load(WATER_URL, (tex) => {
        if (disposed) return tex.dispose();
        mat.specularMap = tex;
        mat.needsUpdate = true;
      });

      const o = ov.createOverlay(g.getGlobeRadius(), anisotropy, renderer);
      g.scene().add(o.mesh);
      overlay.current = o;
      // ?overlay=canvas forces the canvas fallback, ?overlay=shader forces the shader. Safari defaults to the
      // canvas fallback: on a Mac Safari the shader path freezes the globe, while the fallback renders correctly.
      const mode = new URLSearchParams(location.search).get("overlay");
      const safari = /safari/i.test(navigator.userAgent) && !/chrome|chromium|crios|fxios|edgios|android/i.test(navigator.userAgent);
      if (mode === "canvas" || (safari && mode !== "shader")) o.useFallback(mode === "canvas" ? "forced by ?overlay=canvas" : "Safari default");
      // Compile now, so a shader that fails on this GPU switches to the fallback before the first frame.
      renderer.compile(g.scene(), camera);
      // 8k lines on large screens; 4k on phones keeps GPU memory low
      linesCanvas(el.clientWidth < 768 ? 4096 : 8192).then((c) => !disposed && o.setLines(c));

      st.createSky(SKY_RADIUS)
        .then((sky) => (disposed ? undefined : g.scene().add(sky)))
        .catch((e) => console.error("[TerraVestige] star background could not be loaded", e));
      stopMeteors = met.startMeteors(THREE, g.scene(), camera as InstanceType<typeof THREE.PerspectiveCamera>);

      const canvas = renderer.domElement;
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault(); // allow the browser to restore the context; three.js re-uploads everything
        console.error("[TerraVestige] WebGL context lost; waiting for the browser to restore it");
      });
      canvas.addEventListener("webglcontextrestored", () => console.warn("[TerraVestige] WebGL context restored"));

      ro = new ResizeObserver(() => g.width(el.clientWidth).height(el.clientHeight));
      ro.observe(el);
      setReady(true);
      },
    );
    return () => {
      disposed = true;
      clearTimeout(idle.current);
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

  // Marker for the picked place: a pin whose tip sits on the point, with the place name and coordinates.
  useEffect(() => {
    globe.current?.htmlElementsData(picked ? [{ ...picked, el: pinElement(picked.lat, picked.lon, label) }] : []);
  }, [picked, label, ready]);

  useEffect(() => {
    // Hold still while a case file is open; resume the idle rotation when it closes.
    if (picked) stopRotateRef.current();
    else scheduleRotateRef.current();
  }, [picked, ready]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, ms = 1500) => {
      stopRotateRef.current();
      // On phones the case file is a bottom sheet over the lower screen: aim south of the point so the
      // point and its marker land in the visible top part.
      const phone = (host.current?.clientWidth ?? 1000) <= 600;
      globe.current?.pointOfView({ lat: phone ? Math.max(-89, lat - 22) : lat, lng: lon, altitude: 1.6 }, ms);
    },
  }));

  return <div ref={host} className="globe" role="img" aria-label="Interactive globe of trend slope per grid cell" />;
});

function pinElement(lat: number, lon: number, label: string | null): HTMLElement {
  const coords = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
  const el = document.createElement("div");
  el.className = "pin"; // zero-size anchor: the renderer centres it on the point
  const body = document.createElement("div");
  body.className = "pin-body";
  const tag = document.createElement("div");
  tag.className = "pin-label";
  const name = document.createElement("strong");
  name.textContent = label ?? "Selected point"; // text from an outside service: never innerHTML
  const sub = document.createElement("span");
  sub.textContent = coords;
  tag.append(name, sub);
  const stem = document.createElement("div");
  stem.className = "pin-stem";
  const dot = document.createElement("div");
  dot.className = "pin-dot";
  body.append(tag, stem, dot);
  el.append(body);
  return el;
}

export default Globe;
