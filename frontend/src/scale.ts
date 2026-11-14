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

/** Draw the trend colours onto an equirectangular canvas (x = lon -180..180, y = lat 90..-90).
 *  The grid is first painted one pixel per cell and then scaled up with bilinear smoothing, so the
 *  ~2 degree cells blend into a smooth surface. Null cells stay transparent; cells that are not
 *  significant are drawn faded. `alpha` is the overall overlay opacity, so the Earth shows through. */
export function drawOverlay(ctx: CanvasRenderingContext2D, map: TrendMap, limit: number, alpha: number): void {
  const { width: W, height: H } = ctx.canvas;
  const nLat = map.lats.length;
  const nLon = map.lons.length;
  const small = document.createElement("canvas");
  small.width = nLon;
  small.height = nLat;
  const sctx = small.getContext("2d")!;
  const img = sctx.createImageData(nLon, nLat);
  const stops = divergingStops();
  const fadedAlpha = parseFloat(token("--sig-faded-alpha"));
  const northFirst = map.lats[0] > map.lats[nLat - 1];
  for (let i = 0; i < nLat; i++) {
    const row = northFirst ? i : nLat - 1 - i;
    for (let j = 0; j < nLon; j++) {
      const v = map.slope[i][j];
      if (v === null) continue;
      const [r, g, b] = colorAt(stops, v, limit);
      const k = (row * nLon + j) * 4;
      // Near-zero cells are more transparent, so the ocean is not fogged white; strong trends are opaque.
      const strength = limit > 0 ? Math.min(1, Math.abs(v) / limit) : 0;
      const a = (0.35 + 0.65 * strength) * (map.sig[i][j] ? 1 : fadedAlpha);
      img.data.set([r, g, b, Math.round(255 * a)], k);
    }
  }
  sctx.putImageData(img, 0, 0);
  // Pixel centres sit on the cell centres, so the scaled image spans half a cell beyond them.
  const cw = (W * (map.lons[1] - map.lons[0])) / 360;
  const ch = (H * Math.abs(map.lats[1] - map.lats[0])) / 180;
  const x0 = ((map.lons[0] + 180) / 360) * W - cw / 2;
  const y0 = ((90 - Math.max(map.lats[0], map.lats[nLat - 1])) / 180) * H - ch / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "blur(10px)"; // softens the remaining cell edges (ignored by browsers without canvas filters)
  ctx.drawImage(small, x0, y0, cw * nLon, ch * nLat);
  ctx.drawImage(small, x0 + W, y0, cw * nLon, ch * nLat); // fills the strip at the date line
  ctx.restore();
}
