// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import * as THREE from "three";

/* Deep-space backdrop from real catalogue data: the naked-eye stars (magnitude <= 6, Yale Bright Star
   Catalogue via d3-celestial) as soft points sized by brightness and tinted by colour index, plus the
   Milky Way's brightness contours as a blurred glow. The celestial pole sits above Earth's north pole, so
   the sky is the one seen from Earth, and it stays fixed in space while the camera orbits the globe. */

const BASE = "https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35/data";
// Dense faint starfield photo (three-globe example asset) as the base layer under the catalogue stars.
const FIELD_URL = "https://unpkg.com/three-globe@2.45.6/example/img/night-sky.png";

type Ring = [number, number][];
interface Collection<G> {
  features: { properties: { mag?: number; bv?: string }; geometry: G }[];
}

/** Same placement as three-globe's polar-to-Cartesian conversion, with right ascension as longitude. */
function toXYZ(ra: number, dec: number, r: number): [number, number, number] {
  const phi = ((90 - dec) * Math.PI) / 180;
  const theta = ((90 - ra) * Math.PI) / 180;
  return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}

/** Approximate star colour from the B-V colour index (blue-white hot stars to orange cool ones). */
function bvColor(bv: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [-0.4, [0.66, 0.75, 1.0]],
    [0.0, [0.82, 0.87, 1.0]],
    [0.4, [0.98, 0.97, 1.0]],
    [0.8, [1.0, 0.94, 0.86]],
    [1.2, [1.0, 0.84, 0.66]],
    [2.0, [1.0, 0.72, 0.48]],
  ];
  if (!(bv > stops[0][0])) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [b1, c1] = stops[i];
    const [b0, c0] = stops[i - 1];
    if (bv <= b1) {
      const f = (bv - b0) / (b1 - b0);
      return [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = min(1.0, aSize / 2.0);
  gl_PointSize = max(aSize, 1.5) * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 0.45, d);
  float halo = 1.0 - smoothstep(0.0, 1.0, d);
  float a = vAlpha * (core + 0.35 * halo * halo);
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

function starPoints(data: Collection<{ coordinates: [number, number] }>, radius: number): THREE.Points {
  const n = data.features.length;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  data.features.forEach((f, i) => {
    const [ra, dec] = f.geometry.coordinates;
    pos.set(toXYZ(ra, dec, radius), i * 3);
    col.set(bvColor(parseFloat(f.properties.bv ?? "0.6")), i * 3);
    // Apparent size from magnitude: Sirius (-1.4) about 7 px, the faintest naked-eye stars about 1 px.
    size[i] = Math.max(0.8, 1.3 + (6.0 - (f.properties.mag ?? 6)) * 0.95);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: Math.min(2, window.devicePixelRatio || 1) } },
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/** The Milky Way contours, filled level by level and blurred, on an equirectangular canvas. */
function milkyWayCanvas(data: Collection<{ coordinates: Ring[][] }>, field: HTMLImageElement | null): HTMLCanvasElement {
  const W = 4096;
  const H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (field) ctx.drawImage(field, 0, 0, W, H);
  // Draw each shape far off-canvas and keep only its blurred shadow: a soft glow that also works in
  // browsers without canvas filter support.
  ctx.shadowOffsetX = W * 4;
  ctx.shadowBlur = 40;
  ctx.shadowColor = "rgba(190, 200, 235, 0.13)";
  ctx.fillStyle = "#fff";
  for (const f of data.features) {
    for (const poly of f.geometry.coordinates) {
      ctx.beginPath();
      for (const ring of poly) {
        // unwrap longitudes so rings crossing RA = 180 stay continuous, then draw three shifted copies
        let prev = ring[0][0];
        let shift = 0;
        const pts = ring.map(([lon, lat]) => {
          if (lon - prev > 180) shift -= 360;
          else if (prev - lon > 180) shift += 360;
          prev = lon;
          return [lon + shift, lat];
        });
        for (const k of [-360, 0, 360]) {
          pts.forEach(([lon, lat], i) => {
            const x = ((lon + k + 180) / 360) * W - W * 4;
            const y = ((90 - lat) / 180) * H;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
        }
      }
      ctx.fill("evenodd");
    }
  }
  return canvas;
}

/** Load the sky and return it as one group, ready to add to the scene (rejects if the data cannot load). */
export async function createSky(radius: number): Promise<THREE.Group> {
  const [stars, mw] = await Promise.all(
    ["stars.6.json", "mw.json"].map((f) =>
      fetch(`${BASE}/${f}`).then((r) => {
        if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
        return r.json();
      }),
    ),
  );
  const field = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // decoration only: the catalogue stars still show
    img.src = FIELD_URL;
  });
  const group = new THREE.Group();
  const tex = new THREE.CanvasTexture(milkyWayCanvas(mw, field));
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const band = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.02, 64, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true }),
  );
  band.rotation.y = -Math.PI / 2; // uv.x = (RA + 180) / 360, matching toXYZ
  band.renderOrder = -2;
  const points = starPoints(stars, radius);
  points.renderOrder = -1;
  group.add(band, points);
  return group;
}
