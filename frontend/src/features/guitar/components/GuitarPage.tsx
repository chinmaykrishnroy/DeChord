import type { CapoSuggestionMode, ChordSegment, GuitarDisplayMode } from "../../../types/music";
import type { CapoSuggestion, GuitarVoicingShape } from "../model/guitar";
import { Fretboard } from "./Fretboard";

interface GuitarPageProps {
  currentChord: ChordSegment;
  capoSuggestion: CapoSuggestion;
  capoMode: CapoSuggestionMode;
  mode: GuitarDisplayMode;
  shape: GuitarVoicingShape;
  soundEnabled: boolean;
  onCapoModeChange: (mode: CapoSuggestionMode) => void;
  onNotePreview: (note: string, octave?: number) => void;
  onModeChange: (mode: GuitarDisplayMode) => void;
}

export function GuitarPage({
  currentChord,
  capoSuggestion,
  capoMode,
  mode,
  shape,
  soundEnabled,
  onCapoModeChange,
  onNotePreview,
  onModeChange,
}: GuitarPageProps) {
  const canRenderChord = /^[A-G](?:#|b)?$/.test(currentChord.root) && currentChord.tones.length > 0;
  if (!canRenderChord) {
    return (
      <section className="instrument-page guitar-page instrument-page--empty">
        <div className="instrument-toolbar">
          <div>
            <span>Guitar</span>
            <strong>Waiting for chords</strong>
            <small>Import audio and start analysis to show playable guitar shapes.</small>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="instrument-page guitar-page">
      <div className="instrument-toolbar">
        <div>
          <span>Guitar</span>
          <strong>{shape.playedShape}</strong>
          <small>{shape.message}</small>
        </div>

        <div className="instrument-toolbar__actions">
          <div className="segmented-control" role="group" aria-label="Guitar fingering mode">
            <button
              className={mode === "open" ? "active" : ""}
              onClick={() => onModeChange("open")}
              type="button"
            >
              Open
            </button>
            <button
              className={mode === "barre" ? "active" : ""}
              onClick={() => onModeChange("barre")}
              type="button"
            >
              Barre
            </button>
          </div>
          <div className="segmented-control segmented-control--compact" role="group" aria-label="Capo suggestion mode">
            <button
              className={capoMode === "balanced" ? "active" : ""}
              onClick={() => onCapoModeChange("balanced")}
              type="button"
            >
              Reasonable
            </button>
            <button
              className={capoMode === "easy" ? "active" : ""}
              onClick={() => onCapoModeChange("easy")}
              type="button"
            >
              Very easy
            </button>
          </div>
          <div className="capo-pill">
            Capo {capoSuggestion.capo}
            <span>
              {capoSuggestion.easyCount}/{capoSuggestion.totalCount} easy
              {capoSuggestion.impossibleCount > 0 ? ` - ${capoSuggestion.impossibleCount} unsupported` : ""}
            </span>
          </div>
        </div>
      </div>

      <Fretboard
        onNotePreview={onNotePreview}
        shape={shape}
        soundEnabled={soundEnabled}
      />
    </section>
  );
}
