// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { TrendMap } from "./api";
import { drawOverlay } from "./scale";

// Pinned CDN versions. Blue Marble imagery from the three-globe examples; borders from Natural Earth.
export const BASE_URL = "https://unpkg.com/three-globe@2.45.6/example/img/earth-blue-marble.jpg";
export const BUMP_URL = "https://unpkg.com/three-globe@2.45.6/example/img/earth-topology.png";
const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

export interface Basemap {
  image: HTMLImageElement | null; // null when the imagery could not be loaded
  coast: MultiLineString | null;
  borders: MultiLineString | null;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed to draw the image into a canvas
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadLines(): Promise<Pick<Basemap, "coast" | "borders">> {
  try {
    const [res, { mesh }] = await Promise.all([fetch(ATLAS_URL), import("topojson-client")]);
    if (!res.ok) throw new Error(String(res.status));
    const topo = (await res.json()) as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
    return {
      coast: mesh(topo, topo.objects.land),
      borders: mesh(topo, topo.objects.countries, (a, b) => a !== b),
    };
  } catch {
    return { coast: null, borders: null }; // lines are decoration: the globe still works without them
  }
}

export async function loadBasemap(): Promise<Basemap> {
  const [image, lines] = await Promise.all([loadImage(BASE_URL), loadLines()]);
  return { image, ...lines };
}

function strokeLines(ctx: CanvasRenderingContext2D, g: MultiLineString, color: string, width: number): void {
  const { width: W, height: H } = ctx.canvas;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (const line of g.coordinates) {
    for (let k = 1; k < line.length; k++) {
      const [lo0, la0] = line[k - 1];
      const [lo1, la1] = line[k];
      // skip segments that wrap the date line or run along a pole
      if (Math.abs(lo1 - lo0) > 180 || (la0 < -89.5 && la1 < -89.5)) continue;
      ctx.moveTo(((lo0 + 180) / 360) * W, ((90 - la0) / 180) * H);
      ctx.lineTo(((lo1 + 180) / 360) * W, ((90 - la1) / 180) * H);
    }
  }
  ctx.stroke();
}

/** One equirectangular texture: Blue Marble, the smoothed trend overlay (when a map is given),
 *  then coastlines and borders on top. Returned as a blob so the globe can load it by URL. */
export function compose(base: Basemap, map: TrendMap | null, limit: number, alpha: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d")!;
  if (base.image) ctx.drawImage(base.image, 0, 0, canvas.width, canvas.height);
  else {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface-solid").trim();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (map) drawOverlay(ctx, map, limit, alpha);
  if (base.borders) strokeLines(ctx, base.borders, "rgba(255,255,255,0.3)", 1.5);
  if (base.coast) strokeLines(ctx, base.coast, "rgba(255,255,255,0.6)", 2);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}
