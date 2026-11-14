// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import * as THREE from "three";
import type { TrendMap } from "./api";
import { divergingStops } from "./scale";

/* The trend overlay: a translucent sphere just above the Earth. The ~2 degree grid is uploaded as a
   tiny data texture and sampled per pixel with a bicubic B-spline in the fragment shader, so it reads
   as a smooth field at any zoom while the Earth imagery underneath keeps its full resolution.
   Coastlines and borders are a second, mipmapped texture on the same sphere. */

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uData;   // r = valid*(t+1)/2, g = valid*sig, b = valid (premultiplied by validity)
uniform sampler2D uLines;  // white coastlines/borders, alpha = line coverage
uniform bool uHasData;
uniform bool uHasLines;
uniform vec2 uSize;        // data grid size (nLon, nLat)
uniform vec2 uOrigin;      // first cell centre (lon, lat), degrees
uniform vec2 uStep;        // cell size (dlon, dlat), degrees
uniform vec3 uStops[7];    // diverging colour scale, sRGB 0..1
uniform float uAlpha;      // overall overlay opacity
uniform float uFaded;      // extra fade of non-significant cells
varying vec2 vUv;

vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}

// Bicubic B-spline from four bilinear taps (GPU Gems 2, ch. 20).
vec4 bicubic(sampler2D tex, vec2 uv) {
  vec2 inv = 1.0 / uSize;
  uv = uv * uSize - 0.5;
  vec2 f = fract(uv);
  uv -= f;
  vec4 xc = cubic(f.x);
  vec4 yc = cubic(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec4 s0 = texture2D(tex, o.xz);
  vec4 s1 = texture2D(tex, o.yz);
  vec4 s2 = texture2D(tex, o.xw);
  vec4 s3 = texture2D(tex, o.yw);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

vec3 ramp(float t) {
  float x = (t + 1.0) * 3.0;  // 0..6 across the 7 stops
  int i = int(min(floor(x), 5.0));
  float f = x - float(i);
  vec3 a = uStops[0];
  vec3 b = uStops[1];
  for (int k = 1; k < 6; k++) if (k == i) { a = uStops[k]; b = uStops[k + 1]; }
  return mix(a, b, f);
}

void main() {
  vec4 col = vec4(0.0);
  if (uHasData) {
    float lon = vUv.x * 360.0 - 180.0;
    float lat = vUv.y * 180.0 - 90.0;
    vec2 g = vec2((lon - uOrigin.x) / (uSize.x * uStep.x), (lat - uOrigin.y) / (uSize.y * uStep.y)) + 0.5 / uSize;
    vec4 d = bicubic(uData, g);
    if (d.b > 0.02) {
      float t = clamp(d.r / d.b * 2.0 - 1.0, -1.0, 1.0);
      float sig = clamp(d.g / d.b, 0.0, 1.0);
      // Opacity grows with trend strength: near-zero trends stay clear (pale colours over the dark ocean
      // would otherwise read as grey fog), strong trends are fully coloured.
      float a = uAlpha * smoothstep(0.04, 0.6, abs(t)) * mix(uFaded, 1.0, sig) * smoothstep(0.3, 0.7, d.b);
      col = vec4(ramp(t), a);
    }
  }
  if (uHasLines) {
    float la = texture2D(uLines, vUv).a; // white lines composited "over" the trend colour
    float a = la + col.a * (1.0 - la);
    if (a > 0.0) col = vec4((vec3(la) + col.rgb * col.a * (1.0 - la)) / a, a);
  }
  if (col.a < 0.004) discard;
  gl_FragColor = col;
}`;

export interface Overlay {
  mesh: THREE.Mesh;
  setMap: (map: TrendMap | null, limit: number) => void;
  setLines: (canvas: HTMLCanvasElement | null) => void;
  dispose: () => void;
}

function token(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
}

/** Pack the grid into an RGBA8 texture, rows south to north, values premultiplied by validity. */
function dataTexture(map: TrendMap, limit: number): THREE.DataTexture {
  const nLat = map.lats.length;
  const nLon = map.lons.length;
  const northFirst = map.lats[0] > map.lats[nLat - 1];
  const px = new Uint8Array(nLat * nLon * 4);
  for (let i = 0; i < nLat; i++) {
    const row = northFirst ? nLat - 1 - i : i;
    for (let j = 0; j < nLon; j++) {
      const k = (row * nLon + j) * 4;
      px[k + 3] = 255;
      const v = map.slope[i][j];
      if (v === null) continue;
      const t = limit > 0 ? Math.max(-1, Math.min(1, v / limit)) : 0;
      px[k] = Math.round(((t + 1) / 2) * 255);
      px[k + 1] = map.sig[i][j] ? 255 : 0;
      px[k + 2] = 255;
    }
  }
  const tex = new THREE.DataTexture(px, nLon, nLat, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping; // longitude wraps around the date line
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createOverlay(radius: number, anisotropy: number): Overlay {
  const stops = divergingStops().map((c) => new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255));
  const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  empty.needsUpdate = true;
  const uniforms = {
    uData: { value: empty as THREE.Texture },
    uLines: { value: empty as THREE.Texture },
    uHasData: { value: false },
    uHasLines: { value: false },
    uSize: { value: new THREE.Vector2(1, 1) },
    uOrigin: { value: new THREE.Vector2() },
    uStep: { value: new THREE.Vector2(1, 1) },
    uStops: { value: stops },
    uAlpha: { value: token("--overlay-alpha") },
    uFaded: { value: token("--sig-faded-alpha") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    // The camera's depth range reaches the far sky sphere, so depth precision near the globe is coarse:
    // without an offset the Earth pokes through the overlay in specks at phone zoom levels.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.005, 180, 90), material);
  mesh.rotation.y = -Math.PI / 2; // same orientation as the three-globe Earth, so uv = (lon, lat)
  mesh.raycast = () => {}; // clicks go through to the globe

  return {
    mesh,
    setMap(map, limit) {
      if (uniforms.uData.value !== empty) uniforms.uData.value.dispose();
      uniforms.uData.value = empty;
      uniforms.uHasData.value = false;
      if (!map) return;
      const nLat = map.lats.length;
      const nLon = map.lons.length;
      uniforms.uData.value = dataTexture(map, limit);
      uniforms.uSize.value.set(nLon, nLat);
      uniforms.uOrigin.value.set(map.lons[0], Math.min(map.lats[0], map.lats[nLat - 1]));
      uniforms.uStep.value.set(map.lons[1] - map.lons[0], Math.abs(map.lats[1] - map.lats[0]));
      uniforms.uHasData.value = true;
    },
    setLines(canvas) {
      if (uniforms.uLines.value !== empty) uniforms.uLines.value.dispose();
      uniforms.uLines.value = empty;
      uniforms.uHasLines.value = false;
      if (!canvas) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = anisotropy;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      uniforms.uLines.value = tex;
      uniforms.uHasLines.value = true;
    },
    dispose() {
      if (uniforms.uData.value !== empty) uniforms.uData.value.dispose();
      if (uniforms.uLines.value !== empty) uniforms.uLines.value.dispose();
      empty.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
