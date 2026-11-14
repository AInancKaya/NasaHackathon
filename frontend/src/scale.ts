// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { TrendMap } from "./api";

type RGB = [number, number, number];

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The 7 diverging stops from the CSS tokens (--div-1 … --div-7). */
export function divergingStops(): RGB[] {
  return [1, 2, 3, 4, 5, 6, 7].map((i) => hexToRgb(token(`--div-${i}`)));
}

/** Symmetric colour limit: 98th percentile of |slope|, so a few outliers do not wash out the map. */
export function slopeLimit(map: TrendMap): number {
  const abs: number[] = [];
  for (const row of map.slope) for (const v of row) if (v !== null) abs.push(Math.abs(v));
  if (abs.length === 0) return 0;
  abs.sort((a, b) => a - b);
  return abs[Math.floor(0.98 * (abs.length - 1))];
}

/** Map slope in [-limit, +limit] onto the stops (clamped). */
export function colorAt(stops: RGB[], slope: number, limit: number): RGB {
  const t = limit > 0 ? Math.min(1, Math.max(-1, slope / limit)) : 0;
  const x = ((t + 1) / 2) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f)) as RGB;
}

/** Equirectangular canvas: x = lon -180..180, y = lat 90..-90. Null cells stay transparent;
 *  cells that are not significant are drawn faded. */
export function renderTexture(map: TrendMap, limit: number): HTMLCanvasElement {
  const nLat = map.lats.length;
  const nLon = map.lons.length;
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const stops = divergingStops();
  const fadedAlpha = parseFloat(token("--sig-faded-alpha"));
  const cw = (W * (map.lons[1] - map.lons[0])) / 360; // cell size from the actual grid spacing
  const ch = (H * (map.lats[1] - map.lats[0])) / 180;
  // Edges are rounded to whole pixels from cell centres, so neighbours share an edge exactly:
  // no gaps, and no double-blended seams on faded cells. EPS keeps float noise from rounding
  // two copies of the same shared edge differently.
  const EPS = 1e-6;
  for (let i = 0; i < nLat; i++) {
    const cy = ((90 - map.lats[i]) / 180) * H;
    const y0 = Math.round(cy - ch / 2 + EPS);
    const y1 = Math.round(cy + ch / 2 + EPS);
    for (let j = 0; j < nLon; j++) {
      const v = map.slope[i][j];
      if (v === null) continue;
      const [r, g, b] = colorAt(stops, v, limit);
      ctx.globalAlpha = map.sig[i][j] ? 1 : fadedAlpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const cx = ((map.lons[j] + 180) / 360) * W;
      const x0 = Math.round(cx - cw / 2 + EPS);
      ctx.fillRect(x0, y0, Math.round(cx + cw / 2 + EPS) - x0, y1 - y0);
    }
  }
  return canvas;
}
