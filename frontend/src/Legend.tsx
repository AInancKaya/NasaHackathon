// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import type { TrendMap, Variable } from "./api";
import { fmtFetched, meta } from "./varmeta";

interface Props {
  variable: Variable | undefined;
  map: TrendMap | null;
  limit: number;
  loading: boolean;
  error: string | null;
  onMethod: () => void;
}

const num = (x: number) => x.toPrecision(2);

export default function Legend({ variable, map, limit, loading, error, onMethod }: Props) {
  // Only show a note for the variable whose map is on screen.
  const note = map && variable && map.var === variable.id ? meta(variable.id, variable.name, variable.description).note : undefined;

  return (
    <section className="panel legend" aria-label="Legend">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : loading || !map ? (
        <div className="legend-wait" role="status">
          <span className="spinner sm" aria-hidden="true" />
          {variable ? `Loading the ${variable.name.toLowerCase()} map…` : "Loading…"}
        </div>
      ) : (
        <>
          <div className="legend-title">
            <strong>{variable?.name ?? map.var}</strong>
            <span className="muted">
              trend, {map.unit} per decade · {map.period[0]}–{map.period[1]}
            </span>
          </div>
          <div className="bar" aria-hidden="true" />
          <div className="ticks mono">
            <span>≤ −{num(limit)}</span>
            <span>0</span>
            <span>≥ +{num(limit)}</span>
          </div>
          <div className="ticks words" aria-hidden="true">
            <span>Falling</span>
            <span>No change</span>
            <span>Rising</span>
          </div>
          <p className="sr-only">
            Blue means falling, white means no change, red means rising. The colour saturates at plus or minus{" "}
            {num(limit)} {map.unit} per decade.
          </p>
          <div className="legend-faded">
            <span className="swatch" aria-hidden="true">
              <i />
              <i />
            </span>
            <span>
              Faded colour: not significant after correcting for testing thousands of places at once (FDR 5%).
            </span>
          </div>
          {note && <p className="legend-note">{note}</p>}
          <p className="legend-src small">
            {map.source} · fetched {fmtFetched(map.fetched_at)} ·{" "}
            <button className="linkbtn" onClick={onMethod}>
              Method
            </button>
          </p>
        </>
      )}
    </section>
  );
}
