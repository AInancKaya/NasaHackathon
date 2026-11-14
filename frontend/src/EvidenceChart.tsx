// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { Series } from "./api";

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Top panel: raw values, trend fit and 95% band. Bottom panel: deseasonalised anomaly. */
export interface Compare { series: Series; label: string }

/** Trend line in anomaly space: the fit shifted by its mean (anomalies average ~0, and an OLS line passes through the mean). */
const anomalyTrend = (s: Series) => {
  const m = s.fit.reduce((a, b) => a + b, 0) / s.fit.length;
  return s.fit.map((v) => v - m);
};

/** With `other`, one panel overlays both places' anomaly series and trend lines. */
export default function EvidenceChart({
  series, unit, label, other,
}: { series: Series; unit: string; label?: string; other?: Compare }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current!;
    const muted = token("--text-muted");
    const grid = token("--border");
    const raw = token("--div-2");
    const anom = token("--div-6");
    const fit = token("--text");
    const text = token("--text");
    const d = series.dates;
    const axis = {
      gridcolor: "rgba(255,255,255,0.06)", zerolinecolor: grid, linecolor: grid, showline: true,
      tickfont: { color: muted, size: 11 }, ticks: "outside" as const, tickcolor: grid, ticklen: 4,
    };
    const traces = other ? [
      { x: d, y: series.anomaly, mode: "lines", line: { color: token("--cmp-b"), width: 1 }, name: `${label} anomaly`, opacity: 0.55, connectgaps: false },
      { x: other.series.dates, y: other.series.anomaly, mode: "lines", line: { color: token("--cmp-a"), width: 1 }, name: `${other.label} anomaly`, opacity: 0.55, connectgaps: false },
      { x: d, y: anomalyTrend(series), mode: "lines", line: { color: token("--cmp-b"), width: 3 }, name: `${label} trend` },
      { x: other.series.dates, y: anomalyTrend(other.series), mode: "lines", line: { color: token("--cmp-a"), width: 3 }, name: `${other.label} trend` },
    ] as Plotly.Data[] : [
      { x: d, y: series.lo, mode: "lines", line: { width: 0 }, hoverinfo: "skip", showlegend: false },
      {
        x: d, y: series.hi, mode: "lines", line: { width: 0 }, fill: "tonexty",
        fillcolor: "rgba(241,245,249,0.12)", name: "95% band", hoverinfo: "skip",
      },
      { x: d, y: series.values, mode: "lines", line: { color: raw, width: 1 }, name: "Monthly values", connectgaps: false },
      { x: d, y: series.fit, mode: "lines", line: { color: fit, width: 2.5 }, name: "Trend" },
      {
        x: d, y: series.anomaly, mode: "lines", line: { color: anom, width: 1 }, name: "Anomaly",
        xaxis: "x", yaxis: "y2", connectgaps: false,
      },
    ] as Plotly.Data[];
    const layout: Partial<Plotly.Layout> = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: muted, family: token("--font") },
      margin: { l: 52, r: 8, t: 4, b: 28 },
      height: other ? 340 : 320,
      legend: { orientation: "h", y: other ? -0.2 : -0.12, font: { size: 11 } },
      xaxis: { ...axis, type: "date" },
      yaxis: other
        ? { ...axis, title: { text: `anomaly (${unit})`, font: { size: 11 } } }
        : { ...axis, domain: [0.42, 1], title: { text: unit, font: { size: 11 } } },
      yaxis2: { ...axis, domain: [0, 0.34], title: { text: `anomaly (${unit})`, font: { size: 11 } } },
      hovermode: "x unified",
      hoverlabel: { bgcolor: token("--surface-solid"), bordercolor: grid, font: { color: text, size: 12 } },
    };
    Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [series, unit, label, other]);

  useEffect(() => {
    const el = host.current!;
    return () => Plotly.purge(el);
  }, []);

  return <div ref={host} role="img" aria-label="Chart of monthly values, trend line with 95% band, and anomaly" />;
}
