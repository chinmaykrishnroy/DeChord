import { useMemo } from "react";
import type { ChordSegment } from "../../types/music";
import { chordContext } from "./chordContext";
import { GuitarWidget } from "../guitar/components/GuitarWidget";
import { PianoKeyboard } from "../piano/components/PianoKeyboard";

export function InstrumentPractice({
  instrument,
  chords,
  currentChord,
  time,
  onSeek,
  onNotePreview,
}: {
  instrument: "guitar" | "piano";
  chords: ChordSegment[];
  currentChord: ChordSegment;
  time: number;
  onSeek: (time: number) => void;
  onNotePreview: (note: string, octave?: number) => void;
}) {
  const sequence = useMemo(() => chordContext(chords, time), [chords, time]);
  return (
    <section
      className={`instrument-practice instrument-practice--${instrument}`}
    >
      <header className="instrument-practice-heading">
        <div>
          <span className="eyebrow">Practice the changes</span>
          <h1>{instrument === "guitar" ? "Guitar" : "Piano"}</h1>
          <p>
            See the next chord before you need it. Click a chord name to jump
            there.
          </p>
        </div>
        <span className="practice-song-count">
          {chords.filter((c) => c.label !== "N").length} chord changes
        </span>
      </header>
      <div className="instrument-sequence-widget">
        {instrument === "guitar" ? (
          <GuitarWidget
            chord={currentChord}
            chords={chords}
            sequence={sequence}
            onSeek={onSeek}
          />
        ) : (
          <div className="chord-triptych" aria-label="Piano chord sequence">
            {(
              [
                ["previous", "Previous"],
                ["current", "Playing now"],
                ["next", "Up next"],
              ] as const
            ).map(([position, label]) => {
              const segment = sequence[position];
              return (
                <article
                  key={position}
                  className={`sequence-chord sequence-chord--${position}`}
                  aria-label={`${label} piano chord`}
                >
                  <header>
                    <span>{label}</span>
                    <button
                      disabled={!segment}
                      onClick={() => segment && onSeek(segment.startSeconds)}
                    >
                      {segment?.label ?? "—"}
                    </button>
                  </header>
                  {segment && segment.label !== "N" ? (
                    <>
                      <PianoKeyboard
                        chord={segment}
                        compact
                        soundEnabled
                        onNotePreview={onNotePreview}
                      />
                      <p className="sequence-tones">
                        {segment.tones.map((t) => t.note).join(" · ")}
                      </p>
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
        )}
      </div>
      <p className="instrument-practice-hint">
        {instrument === "guitar"
          ? "1 index · 2 middle · 3 ring · 4 little finger. Open circles are open strings; × means mute. One capo setting applies to all three diagrams."
          : "Outlined keys are chord tones. Green marks the root; lighter green marks the third and fifth; blue marks sevenths and extensions. Click any key to hear it."}
      </p>
    </section>
  );
}
