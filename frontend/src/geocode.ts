// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { ApiError, getGeocode } from "./api";

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
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lat: r.lat,
      lon: r.lon,
    }));
  } catch (e) {
    if (e instanceof ApiError && e.error === "not_found") return [];
    throw e;
  }
}
