// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { MultiLineString } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

// Earth: NASA Blue Marble Next Generation (Dec 2004, topography + bathymetry, 5400 x 2700), served with
// open CORS by NASA Science; the 4096 x 2048 copy in the pinned three-globe package is the fallback.
export const EARTH_URL =
  "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december/world.topo.bathy.200412.3x5400x2700.jpg";
export const EARTH_FALLBACK_URL = "https://unpkg.com/three-globe@2.45.6/example/img/earth-blue-marble.jpg";
export const BUMP_URL = "https://unpkg.com/three-globe@2.45.6/example/img/earth-topology.png";
export const SKY_URL = "https://unpkg.com/three-globe@2.45.6/example/img/night-sky.png";
const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";

interface Lines {
  coast: MultiLineString | null;
  borders: MultiLineString | null;
}

async function loadLines(): Promise<Lines> {
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

/** Coastlines and borders on a transparent equirectangular canvas (null if they could not be loaded). */
export async function linesCanvas(width: number): Promise<HTMLCanvasElement | null> {
  const { coast, borders } = await loadLines();
  if (!coast && !borders) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width / 2;
  const ctx = canvas.getContext("2d")!;
  ctx.lineJoin = ctx.lineCap = "round";
  const px = width / 4096; // line widths are tuned for a 4096-wide texture
  if (borders) strokeLines(ctx, borders, "rgba(255,255,255,0.35)", 1.25 * px);
  if (coast) strokeLines(ctx, coast, "rgba(255,255,255,0.6)", 1.5 * px);
  return canvas;
}
