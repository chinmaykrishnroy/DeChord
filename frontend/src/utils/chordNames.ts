import type { ChordSegment, ChordTone } from "../types/music";

export function getChordToneNotes(chord: ChordSegment): string {
  return chord.tones.map((tone) => tone.note).join(" ");
}

export function getChordToneByRole(chord: ChordSegment, role: ChordTone["role"]) {
  return chord.tones.find((tone) => tone.role === role);
}

export function describeChord(chord: ChordSegment): string {
  const root = getChordToneByRole(chord, "root")?.note ?? chord.root;
  return `${root} ${chord.quality}`;
}
