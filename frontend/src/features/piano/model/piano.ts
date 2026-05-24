import type { ChordSegment, ChordTone } from "../../../types/music";
import { normalizeNote } from "../../../utils/musicTheory";

export interface PianoKey {
  id: string;
  note: string;
  octave: number;
  isBlack: boolean;
  whiteIndex: number;
  role?: ChordTone["role"];
}

const octaveNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function getPianoKeys(chord: ChordSegment, startOctave = 3, octaveCount = 2): PianoKey[] {
  let whiteIndex = 0;
  const chordToneMap = new Map(
    chord.tones.map((tone) => [normalizeNote(tone.note), tone.role]),
  );

  return Array.from({ length: octaveCount }, (_, octaveOffset) => startOctave + octaveOffset)
    .flatMap((octave) =>
      octaveNotes.map((note) => {
        const isBlack = note.includes("#");
        const key: PianoKey = {
          id: `${note}-${octave}`,
          note,
          octave,
          isBlack,
          whiteIndex,
          role: chordToneMap.get(normalizeNote(note)),
        };
        if (!isBlack) {
          whiteIndex += 1;
        }
        return key;
      }),
    )
    .concat([
      {
        id: `C-${startOctave + octaveCount}`,
        note: "C",
        octave: startOctave + octaveCount,
        isBlack: false,
        whiteIndex,
        role: chordToneMap.get("C"),
      },
    ]);
}
