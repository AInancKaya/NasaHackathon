// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { Series } from "./api";

const fmt = (x: number) => (Math.abs(x) < 0.01 && x !== 0 ? x.toExponential(1) : x.toFixed(2));
const fmtP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

export default function VerdictCards({ series, unit }: { series: Series; unit: string }) {
  const { verdict: v, stats: s } = series;
  return (
    <div className="cards">
      <section className="card">
        <h3>What</h3>
        <p>{v.what}</p>
      </section>
      <section className="card">
        <h3>Where</h3>
        <p>{v.where}</p>
      </section>
      <section className="card">
        <h3>How much</h3>
        <p>{v.how_much}</p>
        <p className="muted mono">
          Sen's slope {fmt(s.sen_per_decade)} {unit}/decade (95% CI {fmt(s.sen_ci[0])} to {fmt(s.sen_ci[1])})
        </p>
      </section>
      <section className={`card ${v.significant ? "sig" : ""}`}>
        <h3>Significant?</h3>
        <p>{v.significant_text}</p>
        <p className="muted mono">
          Mann-Kendall p (Hamed-Rao) = {fmtP(s.mk_p_hr)} · n = {s.n} months
        </p>
        {s.years_to_detect !== null && (
          <p>
            Not significant yet. About {Math.ceil(s.years_to_detect)} more years of data would be needed to detect
            this trend (Weatherhead et al., 1998).
          </p>
        )}
      </section>
    </div>
  );
}
