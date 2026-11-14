// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

// Types copy docs/CONTRACT.md exactly. Dates are "YYYY-MM"; timestamps are ISO 8601 UTC.

export interface Variable {
  id: string;
  name: string;
  source: string;
  param: string;
  unit: string;
  description: string;
  why_it_matters: string;
  start_year: number;
  end_year: number;
  has_map: boolean;
  has_witness: boolean;
}

export interface SeriesStats {
  n: number;
  mk_p: number;
  mk_p_hr: number;
  tau: number;
  trend: "increasing" | "decreasing" | "no trend";
  sen_per_decade: number;
  sen_ci: [number, number];
  reg_per_decade: number;
  reg_ci: [number, number];
  reg_p: number;
  reg_r2: number;
  ttest_t: number;
  ttest_p: number;
  years_to_detect: number | null;
}

export interface Series {
  var: string;
  lat: number;
  lon: number;
  box: number | null;
  dates: string[];
  values: (number | null)[];
  anomaly: (number | null)[];
  fit: number[];
  lo: number[];
  hi: number[];
  stats: SeriesStats;
  verdict: {
    what: string;
    where: string;
    how_much: string;
    significant: boolean;
    significant_text: string;
  };
  source: string;
  fetched_at: string;
}

export interface Witness {
  var: string;
  lat: number;
  lon: number;
  source: string;
  sen_per_decade: number;
  mk_p: number;
  primary_sen_per_decade: number;
  agrees: boolean;
  fetched_at: string;
}

export interface TrendMap {
  var: string;
  lats: number[];
  lons: number[];
  slope: (number | null)[][];
  sig: (boolean | null)[][];
  period: [number, number];
  unit: string;
  source: string;
  fetched_at: string;
}

export interface Twin {
  var: string;
  origin: { lat: number; lon: number; sen_per_decade: number | null };
  twin: { lat: number; lon: number; sen_per_decade: number } | null;
  period: [number, number];
  fetched_at: string;
}

export interface Case {
  id: string;
  title: string;
  question: string;
  var: string;
  lat: number;
  lon: number;
  box: number | null;
  citation: string;
  citation_url: string;
}

export interface GeoPlace {
  name: string;
  country: string | null;
  admin1: string | null;
  lat: number;
  lon: number;
}

/** Error body of any non-2xx response: { error, detail }. */
export class ApiError extends Error {
  constructor(public error: string, public detail: string) {
    super(`${error}: ${detail}`);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("network_error", "Could not reach the API.");
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const b = body as { error?: string; detail?: string } | undefined;
    if (b?.error) throw new ApiError(b.error, b.detail ?? "");
    throw new ApiError("api_unavailable", `The API did not answer (HTTP ${res.status}). Is the backend running?`);
  }
  if (body === undefined) throw new ApiError("bad_response", "The API returned a non-JSON response.");
  return body as T;
}

export const getVariables = (signal?: AbortSignal) => get<Variable[]>("/api/variables", signal);
export const getTrendMap = (v: string, signal?: AbortSignal) =>
  get<TrendMap>(`/api/trendmap?var=${encodeURIComponent(v)}`, signal);

const q = (v: string, lat: number, lon: number) =>
  `var=${encodeURIComponent(v)}&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
export const getSeries = (v: string, lat: number, lon: number, signal?: AbortSignal, box?: number | null) =>
  get<Series>(`/api/series?${q(v, lat, lon)}${box ? `&box=${box}` : ""}`, signal);
export const getWitness = (v: string, lat: number, lon: number, signal?: AbortSignal) =>
  get<Witness>(`/api/witness?${q(v, lat, lon)}`, signal);
export const getTwin = (v: string, lat: number, lon: number, signal?: AbortSignal) =>
  get<Twin>(`/api/twin?${q(v, lat, lon)}`, signal);
export const getCases = (signal?: AbortSignal) => get<Case[]>("/api/cases", signal);
export const getGeocode = (name: string, signal?: AbortSignal) =>
  get<GeoPlace[]>(`/api/geocode?q=${encodeURIComponent(name)}`, signal);
export const getReverse = (lat: number, lon: number, signal?: AbortSignal) =>
  get<GeoPlace>(`/api/reverse?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, signal);
