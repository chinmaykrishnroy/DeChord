import { useEffect, useRef, useState } from "react";
import type { ChordSegment } from "../../../types/music";
import { getPianoKeys } from "../model/piano";

interface PianoKeyboardProps {
  chord: ChordSegment;
  soundEnabled: boolean;
  onNotePreview: (note: string, octave?: number) => void;
  compact?: boolean;
}

export function PianoKeyboard({
  chord,
  soundEnabled,
  onNotePreview,
  compact = false,
}: PianoKeyboardProps) {
  const keys = getPianoKeys(chord, 3, compact ? 1 : 2);
  const [pressed, setPressed] = useState<string | null>(null);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(release.current), []);
  const whites = keys.filter((key) => !key.isBlack),
    blacks = keys.filter((key) => key.isBlack);
  const play = (note: string, octave: number) => {
    setPressed(`${note}-${octave}`);
    clearTimeout(release.current);
    release.current = setTimeout(() => setPressed(null), 450);
    if (soundEnabled) onNotePreview(note, octave);
  };
  const keyButton = (key: (typeof keys)[number]) => (
    <button
      type="button"
      key={key.id}
      className={`piano-key piano-key--${key.isBlack ? "black" : "white"} ${key.role ? `piano-key--chord piano-key--${key.role}` : ""} ${pressed === key.id ? "is-pressed" : ""}`}
      aria-pressed={pressed === key.id}
      aria-label={`Play ${key.note}${key.octave}${key.role ? `, chord ${key.role}` : ""}`}
      title={`${key.note}${key.octave}${key.role ? ` · ${key.role}` : ""}`}
      style={
        key.isBlack
          ? {
              left: `${(key.whiteIndex / whites.length) * 100}%`,
              width: `${65 / whites.length}%`,
            }
          : undefined
      }
      onClick={() => play(key.note, key.octave)}
    >
      <span>
        {key.note}
        <small>{key.octave}</small>
      </span>
    </button>
  );
  return (
    <div
      className="piano-keyboard"
      role="group"
      aria-label={`Piano keyboard showing ${chord.label}`}
    >
      <div className="piano-whites">{whites.map(keyButton)}</div>
      {blacks.map(keyButton)}
    </div>
  );
}
