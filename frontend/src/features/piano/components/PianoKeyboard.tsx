import type { ChordSegment } from "../../../types/music";
import { getPianoKeys } from "../model/piano";

interface PianoKeyboardProps {
  chord: ChordSegment;
  soundEnabled: boolean;
  onNotePreview: (note: string, octave?: number) => void;
}

const whiteWidth = 58;
const whiteHeight = 238;
const blackWidth = 34;
const blackHeight = 144;

export function PianoKeyboard({ chord, soundEnabled, onNotePreview }: PianoKeyboardProps) {
  const keys = getPianoKeys(chord);
  const whiteKeys = keys.filter((key) => !key.isBlack);
  const blackKeys = keys.filter((key) => key.isBlack);
  const width = whiteKeys.length * whiteWidth;

  return (
    <svg className="piano-keyboard" viewBox={`0 0 ${width} 290`} role="img">
      <title>Piano keyboard showing {chord.label}</title>
      <rect className="piano-keyboard__bed" x="0" y="0" width={width} height="282" rx="22" />

      {whiteKeys.map((key) => (
        <g
          className={`piano-key piano-key--white ${key.role ? `piano-key--${key.role}` : ""}`}
          key={key.id}
          onClick={() => {
            if (soundEnabled) {
              onNotePreview(key.note, key.octave);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <rect
            height={whiteHeight}
            rx="10"
            width={whiteWidth - 4}
            x={key.whiteIndex * whiteWidth + 2}
            y="22"
          />
          <text x={key.whiteIndex * whiteWidth + whiteWidth / 2} y="244">
            {key.note}
          </text>
        </g>
      ))}

      {blackKeys.map((key) => (
        <g
          className={`piano-key piano-key--black ${key.role ? `piano-key--${key.role}` : ""}`}
          key={key.id}
          onClick={() => {
            if (soundEnabled) {
              onNotePreview(key.note, key.octave);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <rect
            height={blackHeight}
            rx="8"
            width={blackWidth}
            x={key.whiteIndex * whiteWidth - blackWidth / 2}
            y="22"
          />
          <text x={key.whiteIndex * whiteWidth} y="132">
            {key.note}
          </text>
        </g>
      ))}
    </svg>
  );
}
