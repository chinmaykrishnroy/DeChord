import type { ChordSegment } from "../../../types/music";
import { PianoKeyboard } from "./PianoKeyboard";

interface PianoPageProps {
  currentChord: ChordSegment;
  soundEnabled: boolean;
  onNotePreview: (note: string, octave?: number) => void;
}

export function PianoPage({ currentChord, soundEnabled, onNotePreview }: PianoPageProps) {
  return (
    <section className="instrument-page piano-page">
      <div className="instrument-toolbar">
        <div>
          <span>Piano</span>
          <strong>Root position</strong>
          <small>Highlighted keys show the current chord tones.</small>
        </div>
        <div className="capo-pill">Chord tones</div>
      </div>

      <PianoKeyboard
        chord={currentChord}
        onNotePreview={onNotePreview}
        soundEnabled={soundEnabled}
      />
    </section>
  );
}
