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
uniform float uFaded;      // opacity of non-significant cells relative to significant ones
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
      // Opacity grows quickly with trend strength: a third of the colour range is already fully coloured,
      // while near-zero trends stay clear (their pale colours would read as grey fog over the dark ocean).
      // Non-significant cells keep their hue at reduced opacity: muted, but still clearly readable.
      float a = uAlpha * smoothstep(0.03, 0.35, abs(t)) * mix(uFaded, 1.0, sig) * smoothstep(0.3, 0.7, d.b);
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
  /** Switch to the canvas fallback (called automatically on a shader or texture failure). */
  useFallback: (why: unknown) => void;
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

/** CPU fallback for GPUs where the shader fails: the same colours and fading painted into an
 *  equirectangular canvas (smoothed by upscaling), with the coastlines drawn on top. */
function paintFallback(canvas: HTMLCanvasElement, map: TrendMap | null, limit: number, lines: HTMLCanvasElement | null) {
  const ctx = canvas.getContext("2d")!;
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  if (map) {
    const stops = divergingStops();
    const alpha = token("--overlay-alpha");
    const faded = token("--sig-faded-alpha");
    const nLat = map.lats.length;
    const nLon = map.lons.length;
    const northFirst = map.lats[0] > map.lats[nLat - 1];
    const cells = document.createElement("canvas");
    cells.width = nLon;
    cells.height = nLat;
    const img = cells.getContext("2d")!.createImageData(nLon, nLat);
    for (let i = 0; i < nLat; i++) {
      const y = northFirst ? i : nLat - 1 - i; // canvas rows run north to south
      for (let j = 0; j < nLon; j++) {
        const v = map.slope[i][j];
        if (v === null) continue;
        const t = limit > 0 ? Math.max(-1, Math.min(1, v / limit)) : 0;
        const x = (t + 1) * 3;
        const k = Math.min(Math.floor(x), 5);
        const f = x - k;
        const c = [0, 1, 2].map((n) => stops[k][n] + (stops[k + 1][n] - stops[k][n]) * f);
        const m = Math.max(0, Math.min(1, (Math.abs(t) - 0.03) / 0.32));
        const a = alpha * m * m * (3 - 2 * m) * (map.sig[i][j] ? 1 : faded);
        const o = (y * nLon + j) * 4;
        img.data.set([c[0], c[1], c[2], Math.round(a * 255)], o);
      }
    }
    cells.getContext("2d")!.putImageData(img, 0, 0);
    const dLon = map.lons[1] - map.lons[0];
    const dLat = Math.abs(map.lats[1] - map.lats[0]);
    const north = Math.max(map.lats[0], map.lats[nLat - 1]) + dLat / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      cells,
      ((map.lons[0] - dLon / 2 + 180) / 360) * W,
      ((90 - north) / 180) * H,
      ((nLon * dLon) / 360) * W,
      ((nLat * dLat) / 180) * H,
    );
  }
  if (lines) ctx.drawImage(lines, 0, 0, W, H);
}

export function createOverlay(radius: number, anisotropy: number, renderer: THREE.WebGLRenderer): Overlay {
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
  const mesh: THREE.Mesh<THREE.SphereGeometry, THREE.Material> = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.005, 180, 90), material);
  mesh.rotation.y = -Math.PI / 2; // same orientation as the three-globe Earth, so uv = (lon, lat)
  mesh.raycast = () => {}; // clicks go through to the globe

  // Guard: if the shader does not compile or a texture upload throws on this GPU, log it and switch to a
  // plain canvas texture, so the globe never ends up black or empty.
  let current: { map: TrendMap | null; limit: number; lines: HTMLCanvasElement | null } = { map: null, limit: 0, lines: null };
  let fallback: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; mat: THREE.MeshBasicMaterial } | null = null;
  const repaint = () => {
    if (!fallback) return;
    paintFallback(fallback.canvas, current.map, current.limit, current.lines);
    fallback.tex.needsUpdate = true;
  };
  const useFallback = (why: unknown) => {
    if (fallback) return;
    console.error("[TerraVestige] trend overlay shader failed; switching to the canvas fallback.", why);
    const canvas = document.createElement("canvas");
    canvas.width = 4096;
    canvas.height = 2048;
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = anisotropy;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    fallback = { canvas, tex, mat };
    mesh.material = mat;
    repaint();
  };
  const previous = renderer.debug.onShaderError;
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    useFallback(`${gl.getProgramInfoLog(program) ?? ""} ${gl.getShaderInfoLog(fs) ?? ""} ${gl.getShaderInfoLog(vs) ?? ""}`);
    previous?.(gl, program, vs, fs);
  };
  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      useFallback(e);
    }
  };

  return {
    mesh,
    useFallback,
    setMap(map, limit) {
      current = { ...current, map, limit };
      if (fallback) return repaint();
      if (uniforms.uData.value !== empty) uniforms.uData.value.dispose();
      uniforms.uData.value = empty;
      uniforms.uHasData.value = false;
      if (!map) return;
      guard(() => {
        // the scale depends on the variable (data-palette), so read the stops again for every map
        divergingStops().forEach((c, k) => uniforms.uStops.value[k].set(c[0] / 255, c[1] / 255, c[2] / 255));
        const nLat = map.lats.length;
        const nLon = map.lons.length;
        uniforms.uData.value = dataTexture(map, limit);
        uniforms.uSize.value.set(nLon, nLat);
        uniforms.uOrigin.value.set(map.lons[0], Math.min(map.lats[0], map.lats[nLat - 1]));
        uniforms.uStep.value.set(map.lons[1] - map.lons[0], Math.abs(map.lats[1] - map.lats[0]));
        uniforms.uHasData.value = true;
      });
    },
    setLines(canvas) {
      current = { ...current, lines: canvas };
      if (fallback) return repaint();
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
      renderer.debug.onShaderError = previous;
      fallback?.tex.dispose();
      fallback?.mat.dispose();
      if (uniforms.uData.value !== empty) uniforms.uData.value.dispose();
      if (uniforms.uLines.value !== empty) uniforms.uLines.value.dispose();
      empty.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
