// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";
import type { Series } from "./api";

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Top panel: raw values, trend fit and 95% band. Bottom panel: deseasonalised anomaly. */
export default function EvidenceChart({ series, unit }: { series: Series; unit: string }) {
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
    const traces = [
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
      height: 320,
      legend: { orientation: "h", y: -0.12, font: { size: 11 } },
      xaxis: { ...axis, type: "date" },
      yaxis: { ...axis, domain: [0.42, 1], title: { text: unit, font: { size: 11 } } },
      yaxis2: { ...axis, domain: [0, 0.34], title: { text: `anomaly (${unit})`, font: { size: 11 } } },
      hovermode: "x unified",
      hoverlabel: { bgcolor: token("--surface-solid"), bordercolor: grid, font: { color: text, size: 12 } },
    };
    Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
  }, [series, unit]);

  useEffect(() => {
    const el = host.current!;
    return () => Plotly.purge(el);
  }, []);

  return <div ref={host} role="img" aria-label="Chart of monthly values, trend line with 95% band, and anomaly" />;
}
