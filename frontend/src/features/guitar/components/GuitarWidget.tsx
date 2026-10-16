import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import type { ChordSegment, GuitarDisplayMode } from "../../../types/music";
import { getGuitarShape, getGuitarVoicings } from "../model/guitar";
import {
  getGuitarPlan,
  type GuitarPlan,
} from "../../../services/backendClient";
import { Fretboard } from "./Fretboard";
import { useInstrumentSampler } from "../../instruments/useInstrumentSampler";
import { usePracticePreferences } from "../../workspace/usePracticeSession";
export function GuitarWidget({
  chord,
  chords,
  sequence,
  onSeek,
}: {
  chord: ChordSegment;
  chords: ChordSegment[];
  sequence?: {
    previous: ChordSegment | null;
    current: ChordSegment | null;
    next: ChordSegment | null;
  };
  onSeek?: (time: number) => void;
}) {
  const { guitar, setGuitar } = usePracticePreferences();
  const { mode, capo, autoCapo, easyShapes } = guitar;
  const setMode = (mode: GuitarDisplayMode) =>
    setGuitar((g) => ({ ...g, mode }));
  const setCapo = (capo: number) => setGuitar((g) => ({ ...g, capo }));
  const setAutoCapo = (autoCapo: boolean) =>
    setGuitar((g) => ({ ...g, autoCapo }));
  const setEasyShapes = (change: (shapes: string[]) => string[]) =>
    setGuitar((g) => ({ ...g, easyShapes: change(g.easyShapes) }));
  const [plan, setPlan] = useState<GuitarPlan | null>(null),
    [planError, setPlanError] = useState(""),
    [planning, setPlanning] = useState(false),
    [alternative, setAlternative] = useState(0);
  const sampler = useInstrumentSampler(true);
  const requestedCapo = autoCapo ? null : capo;
  useEffect(() => {
    const controller = new AbortController();
    setPlan(null);
    setPlanError("");
    setPlanning(true);
    getGuitarPlan(chords, easyShapes, mode, requestedCapo, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPlan(result);
        if (result.automatic) {
          setCapo(result.capo);
          setAlternative(0);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setPlanError(`Capo planning unavailable: ${error.message}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanning(false);
      });
    return () => controller.abort();
  }, [chords, easyShapes, mode, requestedCapo]);
  const shapes = useMemo(
    () => getGuitarVoicings(chord, mode, capo),
    [chord, mode, capo],
  );
  const shape =
    shapes[alternative % Math.max(1, shapes.length)] ??
    getGuitarShape(chord, mode, capo);
  const silent = chord.label === "N" || !chord.root;
  return (
    <div
      className={`guitar-widget ${sequence ? "guitar-widget--sequence" : ""}`}
    >
      {sampler.error && (
        <p className="inline-error" role="status">
          Note preview unavailable: {sampler.error}
        </p>
      )}
      <div className="widget-toolbar">
        <div className="segments" aria-label="Chord shape mode">
          {(["open", "barre"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setAlternative(0);
              }}
            >
              {m === "open" ? "Open / compact" : "Barre"}
            </button>
          ))}
        </div>
        <label className="inline-field">
          Capo{" "}
          <select
            aria-label="Capo fret"
            value={capo}
            onChange={(e) => {
              setAutoCapo(false);
              setCapo(+e.target.value);
              setAlternative(0);
            }}
          >
            {Array.from({ length: 13 }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "None" : `Fret ${i}`}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <input
            type="checkbox"
            aria-label="Automatic capo"
            checked={autoCapo}
            onChange={(e) => setAutoCapo(e.target.checked)}
          />
          Auto capo
        </label>
      </div>
      <details className="easy-shapes">
        <summary>
          Easy chord preferences ·{" "}
          {planning
            ? "calculating…"
            : `capo ${capo}${autoCapo ? " · automatic" : " · manual"}`}
        </summary>
        <div>
          {[
            "C",
            "D",
            "E",
            "F",
            "G",
            "A",
            "B",
            "Am",
            "Bm",
            "Dm",
            "Em",
            "A7",
            "B7",
            "C7",
            "D7",
            "E7",
            "G7",
            "AM7",
            "CM7",
            "DM7",
            "EM7",
            "Asus2",
            "Asus4",
            "Dsus2",
            "Dsus4",
            "Cadd9",
          ].map((label) => (
            <label key={label}>
              <input
                type="checkbox"
                checked={easyShapes.includes(label)}
                onChange={(e) =>
                  setEasyShapes((list) =>
                    e.target.checked
                      ? [...list, label]
                      : list.filter((s) => s !== label),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        {plan && (
          <p>
            {plan.easy_count}/{plan.total_count} familiar shapes ·{" "}
            {plan.shape_labels.join(" · ")}. Calculated by the local engine,
            weighted by time spent on each chord.
          </p>
        )}
      </details>
      {planError && (
        <p className="inline-error" role="status">
          {planError}
        </p>
      )}
      {sequence ? (
        <div className="chord-triptych" aria-label="Guitar chord sequence">
          {(
            [
              ["previous", "Previous"],
              ["current", "Playing now"],
              ["next", "Up next"],
            ] as const
          ).map(([position, label]) => {
            const segment = sequence[position];
            const diagram = segment
              ? position === "current"
                ? shape
                : getGuitarShape(segment, mode, capo)
              : null;
            return (
              <article
                key={position}
                className={`sequence-chord sequence-chord--${position}`}
                aria-label={`${label} guitar chord`}
              >
                <header>
                  <span>{label}</span>
                  <button
                    disabled={!segment}
                    onClick={() => segment && onSeek?.(segment.startSeconds)}
                    title="Seek to this chord"
                  >
                    {segment?.label ?? "—"}
                  </button>
                </header>
                {diagram && segment?.label !== "N" ? (
                  <>
                    <p className="sequence-shape">
                      Play <strong>{diagram.playedShape}</strong>
                      {capo > 0 && ` · capo ${capo}`}
                    </p>
                    <Fretboard
                      shape={diagram}
                      orientation="vertical"
                      showLegend={false}
                      soundEnabled
                      onNotePreview={(note, octave) =>
                        sampler.playNote("guitar", note, octave)
                      }
                    />
                    <small>
                      {diagram.playable
                        ? "Frets shown relative to capo"
                        : diagram.message}
                    </small>
                  </>
                ) : (
                  <div className="sequence-empty">
                    {segment?.label === "N"
                      ? "Rest · no chord"
                      : position === "previous"
                        ? "Start of song"
                        : position === "next"
                          ? "End of song"
                          : "No chord at this position"}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : silent ? (
        <div className="empty-state">
          <strong>
            {chords.length ? "No chord at this position" : "Waiting for chords"}
          </strong>
          <p>Seek to a chord segment to see its fingering.</p>
        </div>
      ) : (
        <>
          <div className="shape-summary" title={shape.message}>
            <div>
              <strong>{shape.playedShape}</strong>
              <span>
                {capo
                  ? `shape → sounds ${chord.label}`
                  : "Standard tuning · E A D G B e"}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Strum chord"
              disabled={!shape.playable}
              onClick={() =>
                sampler.playChord(
                  "guitar",
                  [...shape.positions]
                    .reverse()
                    .filter((p) => p.note)
                    .map((p, i) => ({
                      note: p.note!,
                      octave: p.octave!,
                      delaySeconds: i * 0.035,
                    })),
                )
              }
            >
              <Volume2 size={19} />
            </button>
            <div className="shape-footer">
              <span>{shape.message}</span>
              <div className="shape-navigation">
                <button
                  className="icon-button"
                  aria-label="Previous voicing"
                  disabled={shapes.length < 2}
                  onClick={() =>
                    setAlternative(
                      (v) => (v + shapes.length - 1) % shapes.length,
                    )
                  }
                >
                  <ChevronLeft size={16} />
                </button>
                <small>
                  {shapes.length ? (alternative % shapes.length) + 1 : 0} /{" "}
                  {shapes.length}
                </small>
                <button
                  className="icon-button"
                  aria-label="Next voicing"
                  disabled={shapes.length < 2}
                  onClick={() => setAlternative((v) => (v + 1) % shapes.length)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <Fretboard
            shape={shape}
            soundEnabled
            onNotePreview={(note, octave) =>
              sampler.playNote("guitar", note, octave)
            }
          />
        </>
      )}
    </div>
  );
}
