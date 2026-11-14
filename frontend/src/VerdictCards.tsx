// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useContext } from "react";
import type { Series } from "./api";
import { PlaceName } from "./placeName";

const fmtP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const fmtS = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(3)}`;
/** Below this share of residual variance removed, the two-part line is not worth reporting as a change. */
const MIN_FIT_GAIN = 0.1;

export default function VerdictCards({ series, unit }: { series: Series; unit?: string }) {
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
      <section className={`card span ${v.significant ? "sig" : ""}`}>
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
      {s.segments && (
        <section className="card span">
          <h3>Has the pace changed?</h3>
          {s.segments.fit_gain < MIN_FIT_GAIN ? (
            <p>No clear change of pace: one steady trend fits about as well as a two-part one.</p>
          ) : (
            <p>
              Before {s.segments.break_year}: <strong>{fmtS(s.segments.before_per_decade)}</strong> · after:{" "}
              <strong>{fmtS(s.segments.after_per_decade)}</strong> {unit ?? ""} per decade
            </p>
          )}
          <p className="muted">
            Exploratory: the break year is the one that fits best, chosen from the data, so treat it as a lead
            to investigate, not as a test result.
          </p>
        </section>
      )}
    </div>
  );
}
