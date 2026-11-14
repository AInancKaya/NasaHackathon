// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useContext } from "react";
import type { Series } from "./api";
import { PlaceName } from "./placeName";

const fmtP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

export default function VerdictCards({ series }: { series: Series; unit?: string }) {
  const { verdict: v, stats: s } = series;
  const place = useContext(PlaceName);
  return (
    <div className="cards">
      <section className="card span">
        <h3>What</h3>
        <p>{v.what}</p>
      </section>
      <section className="card">
        <h3>Where</h3>
        {place && <p>{place}</p>}
        <p className={place ? "muted mono" : undefined}>{v.where}</p>
      </section>
      <section className="card">
        <h3>How much</h3>
        <p>{v.how_much}</p>
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
