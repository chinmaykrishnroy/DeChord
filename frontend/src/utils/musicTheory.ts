import type { ChordSegment, ChordTone, ChordToneRole } from "../types/music";

export const chromaticNotes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const flatNotes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const noteToPitchClass: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  "E#": 5,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const enharmonicNotes: Record<string, string> = {
  Bb: "A#",
  Cb: "B",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  "E#": "F",
  Gb: "F#",
  Ab: "G#",
  "B#": "C",
};

const chordPattern =
  /^\s*(?<root>[A-G](?:#|b)?)(?<suffix>[^/]*)?(?:\/(?<bass>[A-G](?:#|b)?))?\s*$/;

export function normalizeNote(note: string): string {
  return enharmonicNotes[note.replace(/\d/g, "")] ?? note.replace(/\d/g, "");
}

export function pitchClassForNote(note: string): number {
  return noteToPitchClass[note.replace(/\d/g, "")] ?? noteToPitchClass[normalizeNote(note)] ?? 0;
}

export function displayChordLabel(label: string): string {
  if (!label || label === "N") {
    return label;
  }

  const match = chordPattern.exec(label);
  if (!match?.groups) {
    return label;
  }

  const suffix = (match.groups.suffix ?? "").replace(/maj/gi, "M");
  const bass = match.groups.bass ? `/${match.groups.bass}` : "";
  return `${match.groups.root}${suffix}${bass}`;
}

function noteNamesForSource(note: string) {
  return note.includes("b") ? flatNotes : chromaticNotes;
}

export function transposeNote(note: string, semitones: number): string {
  const cleanNote = note.replace(/\d/g, "");
  const pitchClass = pitchClassForNote(cleanNote);
  const names = noteNamesForSource(cleanNote);
  return names[(pitchClass + semitones + 1200) % 12];
}

export function transposeChordLabel(label: string, semitones: number): string {
  const displayed = displayChordLabel(label);
  if (!displayed || displayed === "N") {
    return "N";
  }

  const match = chordPattern.exec(displayed);
  if (!match?.groups) {
    return displayed;
  }

  const root = transposeNote(match.groups.root, semitones);
  const suffix = match.groups.suffix ?? "";
  const bass = match.groups.bass ? `/${transposeNote(match.groups.bass, semitones)}` : "";
  return `${root}${suffix}${bass}`;
}

export function transposeChordSegment(chord: ChordSegment, semitones: number): ChordSegment {
  if (semitones === 0 || chord.label === "N") {
    return {
      ...chord,
      label: displayChordLabel(chord.label),
    };
  }

  return {
    ...chord,
    label: transposeChordLabel(chord.label, semitones),
    root: chord.root ? transposeNote(chord.root, semitones) : chord.root,
    tones: chord.tones.map((tone) => ({
      ...tone,
      note: transposeNote(tone.note, semitones),
    })),
  };
}

export function chordSuffix(label: string): string {
  const match = chordPattern.exec(displayChordLabel(label));
  return match?.groups?.suffix?.replace(/M/g, "maj") ?? "";
}

export function intervalsForChord(chord: ChordSegment): number[] {
  if (!chord.root || chord.label === "N") {
    return [];
  }

  const rootPc = pitchClassForNote(chord.root);
  if (chord.tones.length > 0) {
    return chord.tones.map((tone) => (pitchClassForNote(tone.note) - rootPc + 12) % 12);
  }

  const suffix = chordSuffix(chord.label).toLowerCase();
  if (suffix.startsWith("m7b5")) return [0, 3, 6, 10];
  if (suffix.startsWith("dim7")) return [0, 3, 6, 9];
  if (suffix.startsWith("dim")) return [0, 3, 6];
  if (suffix.startsWith("aug")) return [0, 4, 8];
  if (suffix.includes("sus2")) return [0, 2, 7];
  if (suffix.includes("sus4") || suffix.startsWith("sus")) return [0, 5, 7];
  if (suffix === "5") return [0, 7];
  if (suffix.startsWith("m") && !suffix.startsWith("maj")) return suffix.includes("7") ? [0, 3, 7, 10] : [0, 3, 7];
  if (suffix.includes("maj7")) return [0, 4, 7, 11];
  if (suffix.includes("7")) return [0, 4, 7, 10];
  if (suffix.includes("6")) return [0, 4, 7, 9];
  return [0, 4, 7];
}

export function chordPitchClasses(chord: ChordSegment): Set<number> {
  const rootPc = pitchClassForNote(chord.root);
  return new Set(intervalsForChord(chord).map((interval) => (rootPc + interval) % 12));
}

export function roleForPitchClass(note: string, chord: ChordSegment): ChordToneRole | undefined {
  const notePc = pitchClassForNote(note);
  const rootPc = pitchClassForNote(chord.root);
  const interval = (notePc - rootPc + 12) % 12;
  if (interval === 0) return "root";
  if ([2, 3, 4, 5].includes(interval)) return "third";
  if ([6, 7, 8].includes(interval)) return "fifth";
  if ([9, 10, 11].includes(interval)) return "seventh";
  return "extension";
}

export function toneRoleForIndex(index: number): ChordToneRole {
  return (["root", "third", "fifth", "seventh", "extension"] as ChordToneRole[])[
    Math.min(index, 4)
  ];
}

export function buildTones(root: string, notes: string[]): ChordTone[] {
  const rootPc = pitchClassForNote(root);
  return notes.map((note, index) => {
    const interval = (pitchClassForNote(note) - rootPc + 12) % 12;
    return {
      note,
      role:
        interval === 0
          ? "root"
          : interval === 3 || interval === 4
            ? "third"
            : interval === 6 || interval === 7 || interval === 8
              ? "fifth"
              : interval >= 9
                ? "seventh"
                : toneRoleForIndex(index),
    };
  });
}

export function midiForNote(note: string, octave = 4): number {
  return (octave + 1) * 12 + pitchClassForNote(note);
}

export function frequencyForNote(note: string, octave = 4): number {
  const midi = midiForNote(note, octave);
  return 440 * 2 ** ((midi - 69) / 12);
}
