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

/** Symmetric colour limit: 90th percentile of |slope|; stronger cells are clamped (the legend says so).
 *  Rainfall, humidity and soil wetness trends are heavy-tailed: with a higher percentile most of the
 *  map sits near zero and renders as a pale fog that looks the same for every variable. */
export function slopeLimit(map: TrendMap): number {
  const abs: number[] = [];
  for (const row of map.slope) for (const v of row) if (v !== null) abs.push(Math.abs(v));
  if (abs.length === 0) return 0;
  abs.sort((a, b) => a - b);
  return abs[Math.floor(0.9 * (abs.length - 1))];
}
