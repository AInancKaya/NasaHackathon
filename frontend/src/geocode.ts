// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

// Place search: the free, no-login Open-Meteo geocoding API. Only the typed text is sent.
const GEOCODE = "https://geocoding-api.open-meteo.com/v1/search";

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export async function geocode(name: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${GEOCODE}?name=${encodeURIComponent(name)}&count=5&language=en&format=json`, { signal });
  if (!res.ok) throw new Error(`Geocoding failed (HTTP ${res.status}).`);
  const body = (await res.json()) as {
    results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[];
  };
  return (body.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  }));
}
