// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { ApiError, getGeocode, getReverse } from "./api";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

/** Place search through the backend (GET /api/geocode). "No match" is an empty list, not an error. */
export async function geocode(name: string, signal?: AbortSignal): Promise<Place[]> {
  try {
    const found = await getGeocode(name, signal);
    return found.map((r) => ({
      // drop repeats such as "Istanbul, Istanbul, Türkiye"
      label: [r.name, r.admin1, r.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", "),
      lat: r.lat,
      lon: r.lon,
    }));
  } catch (e) {
    // Only the "no match" answer is an empty list. Any other 404 (e.g. a server too old to have this
    // endpoint) must show as an error, not as "no place found".
    if (e instanceof ApiError && e.error === "not_found" && e.detail.startsWith("No place found")) return [];
    throw e;
  }
}

/** "City, Country" for a clicked point (GET /api/reverse), or null where there is no named place. */
export async function placeAt(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const p = await getReverse(lat, lon, signal);
    return [p.name, p.country].filter((x, i, a) => x && a.indexOf(x) === i).join(", ") || null;
  } catch (e) {
    if (e instanceof ApiError) return null; // open ocean, or the lookup failed: the marker shows coordinates
    throw e;
  }
}
