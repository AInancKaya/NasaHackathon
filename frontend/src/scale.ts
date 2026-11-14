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

/** Water variables use a brown-to-teal scale (ColorBrewer BrBG: brown = drier, teal = wetter), because
 *  red for "more rain" reads backwards. Set as data-palette on <html>; tokens.css swaps --div-1 … --div-7. */
const WET = new Set(["prectotcorr", "gwettop", "rh2m", "tqv"]);

export function paletteFor(varId: string | null | undefined): "wet" | "heat" {
  return varId && WET.has(varId) ? "wet" : "heat";
}

/** Colour words for text that names the scale. */
export const PALETTE_WORDS = {
  heat: { down: "blue", up: "red" },
  wet: { down: "brown", up: "teal" },
} as const;

/** The 7 diverging stops from the CSS tokens (--div-1 … --div-7). */
export function divergingStops(): RGB[] {
  return [1, 2, 3, 4, 5, 6, 7].map((i) => hexToRgb(token(`--div-${i}`)));
}

/** Share of significant cells that stay below the colour limit; the rest are clamped (the legend says so). */
const LIMIT_QUANTILE = 0.9;

/** Robust symmetric colour limit: the 90th percentile of |slope| over the significant cells, so the range
 *  describes the trends that are real and a few extreme cells (rainfall, humidity and soil wetness are
 *  heavy-tailed) cannot stretch it until the rest of the map renders pale. Falls back to all cells when
 *  none is significant. The legend shows the same value as "<= -x" and ">= +x". */
export function slopeLimit(map: TrendMap): number {
  const all: number[] = [];
  const sig: number[] = [];
  map.slope.forEach((row, i) =>
    row.forEach((v, j) => {
      if (v === null) return;
      all.push(Math.abs(v));
      if (map.sig[i][j]) sig.push(Math.abs(v));
    }),
  );
  const abs = sig.length ? sig : all;
  if (abs.length === 0) return 0;
  abs.sort((a, b) => a - b);
  return abs[Math.floor(LIMIT_QUANTILE * (abs.length - 1))];
}
