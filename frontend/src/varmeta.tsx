// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

// UI-only labels for the variables from GET /api/variables: group, icon and a one-line plain description.
// No numbers here; everything shown about a variable's data comes from the API.
import type { ReactNode } from "react";
import { IconDrop, IconRain, IconSoil, IconThermo, IconThermoDown, IconThermoUp, IconVapour, IconWind } from "./icons";

export type Group = "Temperature" | "Water" | "Wind" | "Other";
export const GROUPS: Group[] = ["Temperature", "Water", "Wind", "Other"];

interface Meta {
  group: Group;
  short: string; // short picker name
  line: string; // one plain sentence
  icon: (size?: number) => ReactNode;
  note?: string; // legend note that only applies to this variable
}

const META: Record<string, Meta> = {
  t2m: { group: "Temperature", short: "Mean temperature", line: "Average air temperature at head height.", icon: (s) => <IconThermo size={s} /> },
  t2m_max: { group: "Temperature", short: "Hottest daytime", line: "How hot the afternoons get.", icon: (s) => <IconThermoUp size={s} /> },
  t2m_min: { group: "Temperature", short: "Coolest night", line: "How cold the nights get.", icon: (s) => <IconThermoDown size={s} /> },
  prectotcorr: { group: "Water", short: "Precipitation", line: "Rain and snow reaching the ground.", icon: (s) => <IconRain size={s} /> },
  gwettop: {
    group: "Water",
    short: "Soil wetness",
    line: "How wet the topsoil is, from dry to soaked.",
    icon: (s) => <IconSoil size={s} />,
    note: "Soil wetness is only measured on land, so the oceans have no data.",
  },
  rh2m: { group: "Water", short: "Humidity", line: "How close the air is to saturation.", icon: (s) => <IconDrop size={s} /> },
  tqv: { group: "Water", short: "Water vapour", line: "All the moisture in the air column above.", icon: (s) => <IconVapour size={s} /> },
  ws10m: { group: "Wind", short: "Wind speed", line: "Average wind 10 m above the ground.", icon: (s) => <IconWind size={s} /> },
};

export function meta(id: string, name: string, description: string): Meta {
  return META[id] ?? { group: "Other", short: name, line: description, icon: (s) => <IconThermo size={s} /> };
}

/** "2026-11-14T11:59:55Z" -> "14 Nov 2026, 11:59 UTC" (the cache keeps the original fetch time). */
export function fmtFetched(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}
