// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.
import { useEffect, useRef, useState } from "react";
import type { Variable } from "./api";
import { IconCheck, IconChevron } from "./icons";
import { GROUPS, meta } from "./varmeta";

interface Props {
  vars: Variable[] | null;
  value: string | null;
  loading: boolean; // the map of `value` is loading
  onChange: (id: string) => void;
}

/** Grouped variable picker: a summary button that opens a list grouped by Temperature / Water / Wind. */
export default function VarPicker({ vars, value, loading, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = vars?.find((v) => v.id === value);
  const m = current ? meta(current.id, current.name, current.description) : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      className="vp"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault(); // close the list, not the case file
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>(".vp-trigger")?.focus();
        }
      }}
    >
      <button
        className="vp-trigger"
        aria-expanded={open}
        aria-controls="vp-list"
        disabled={!vars?.length}
        onClick={() => setOpen(!open)}
      >
        <span className="vp-ico">{m ? m.icon(22) : null}</span>
        <span className="vp-text">
          <span className="vp-label">Variable</span>
          <span className="vp-name">{m?.short ?? "Loading variables…"}</span>
        </span>
        {loading ? <span className="spinner sm" aria-label="Loading map" /> : <IconChevron dir={open ? "up" : "down"} />}
      </button>
      {current && !open && <p className="vp-desc">{m?.line} <span className="unit-chip">{current.unit} per decade</span></p>}

      {open && vars && (
        <div id="vp-list" className="vp-list" role="radiogroup" aria-label="Choose a variable">
          {GROUPS.map((g) => {
            const items = vars.filter((v) => meta(v.id, v.name, v.description).group === g);
            if (!items.length) return null;
            return (
              <div key={g} className="vp-group" role="group" aria-label={g}>
                <div className="vp-group-name">{g}</div>
                {items.map((v) => {
                  const im = meta(v.id, v.name, v.description);
                  const active = v.id === value;
                  return (
                    <button
                      key={v.id}
                      role="radio"
                      aria-checked={active}
                      className="vp-item"
                      onClick={() => {
                        onChange(v.id);
                        setOpen(false);
                      }}
                    >
                      <span className="vp-ico">{im.icon(20)}</span>
                      <span className="vp-text">
                        <span className="vp-name">{im.short}</span>
                        <span className="vp-line">{im.line}</span>
                      </span>
                      {active && (loading ? <span className="spinner sm" aria-label="Loading map" /> : <IconCheck />)}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
