import type {
  CapoSuggestionMode,
  ChordSegment,
  ChordTone,
  GuitarDisplayMode,
} from "../../../types/music";
import {
  chordPitchClasses,
  chordSuffix,
  chromaticNotes,
  normalizeNote,
  pitchClassForNote,
  roleForPitchClass,
  transposeNote,
} from "../../../utils/musicTheory";

export { chromaticNotes, normalizeNote, transposeNote };

const displayFretCount = 10;
const maxSuggestedCapo = 7;
const highCapoStart = 5;

export const guitarStrings = [
  { label: "e", note: "E", octave: 4 },
  { label: "B", note: "B", octave: 3 },
  { label: "G", note: "G", octave: 3 },
  { label: "D", note: "D", octave: 3 },
  { label: "A", note: "A", octave: 2 },
  { label: "E", note: "E", octave: 2 },
];

export interface GuitarFingerPosition {
  stringIndex: number;
  stringLabel: string;
  fret: number | "x";
  note?: string;
  octave?: number;
  role?: ChordTone["role"];
  finger?: number;
}

export interface GuitarVoicingShape {
  label: string;
  mode: GuitarDisplayMode;
  capo: number;
  playedShape: string;
  displayFrets: number[];
  positions: GuitarFingerPosition[];
  barreFret?: number;
  message: string;
  playable: boolean;
  difficulty: number;
}

export interface ChordDifficulty {
  chord: string;
  playedShape: string;
  difficulty: number;
  label: string;
  mode: GuitarDisplayMode;
  fret: number;
  playable: boolean;
  reason?: string;
}

export interface CapoSuggestion {
  capo: number;
  mode: CapoSuggestionMode;
  score: number;
  easyCount: number;
  totalCount: number;
  easyPercent: number;
  hardCount: number;
  impossibleCount: number;
  averageDifficulty: number;
  shapeLabels: string[];
  chordDifficulties: ChordDifficulty[];
}

interface VoicingDefinition {
  frets: Array<number | "x">;
  difficulty: number;
  family: GuitarDisplayMode;
}

interface VoicingCandidate {
  playedShape: string;
  mode: GuitarDisplayMode;
  frets: Array<number | "x">;
  difficulty: number;
  fret: number;
  label: string;
  source: "open" | "barre-e" | "barre-a";
}

function noteAtFretWithOctave(openNote: string, openOctave: number, fret: number) {
  const openPc = pitchClassForNote(openNote);
  const note = chromaticNotes[(openPc + fret) % 12];
  const octave = openOctave + Math.floor((openPc + fret) / 12);
  return { note, octave };
}

export function getNoteAtFret(openNote: string, fret: number): string {
  return noteAtFretWithOctave(openNote, 3, fret).note;
}

function getSimpleSuffix(chord: ChordSegment) {
  const suffix = chordSuffix(chord.label).toLowerCase();
  const quality = chord.quality.toLowerCase();

  if (suffix.startsWith("m7b5")) return "m7b5";
  if (suffix.startsWith("dim7")) return "dim7";
  if (suffix.startsWith("dim")) return "dim";
  if (suffix.startsWith("aug7")) return "aug7";
  if (suffix.startsWith("aug")) return "aug";
  if (suffix.includes("sus2")) return "sus2";
  if (suffix.includes("sus4") || suffix.startsWith("sus")) return "sus4";
  if (suffix.includes("maj7")) return "M7";
  if (suffix.startsWith("m7")) return "m7";
  if (suffix.startsWith("m6")) return "m6";
  if (suffix.startsWith("m9")) return "m9";
  if (suffix.startsWith("m")) return "m";
  if (suffix.includes("7")) return "7";
  if (suffix.includes("6")) return "6";
  if (quality.includes("major seventh")) return "M7";
  if (quality.includes("minor seventh")) return "m7";
  if (quality.includes("dominant seventh")) return "7";
  if (quality.includes("minor")) return "m";
  return "";
}

function shapeLabel(root: string, suffix: string) {
  return `${root}${suffix}`;
}

export function getPlayedShapeLabel(chord: ChordSegment, capo: number): string {
  return shapeLabel(transposeNote(chord.root, -capo), getSimpleSuffix(chord));
}

const openVoicings: Record<string, VoicingDefinition> = {
  A: { frets: [0, 2, 2, 2, 0, "x"], difficulty: 1.1, family: "open" },
  Am: { frets: [0, 1, 2, 2, 0, "x"], difficulty: 1.1, family: "open" },
  A7: { frets: [0, 2, 0, 2, 0, "x"], difficulty: 1.3, family: "open" },
  Am7: { frets: [0, 1, 0, 2, 0, "x"], difficulty: 1.4, family: "open" },
  AM7: { frets: [0, 2, 1, 2, 0, "x"], difficulty: 1.8, family: "open" },
  Asus2: { frets: [0, 0, 2, 2, 0, "x"], difficulty: 1.2, family: "open" },
  Asus4: { frets: [0, 3, 2, 2, 0, "x"], difficulty: 1.5, family: "open" },
  B7: { frets: [2, 0, 2, 1, 2, "x"], difficulty: 2.6, family: "open" },
  Bm7: { frets: [2, 0, 2, 0, 2, "x"], difficulty: 2.8, family: "open" },
  C: { frets: [0, 1, 0, 2, 3, "x"], difficulty: 1.2, family: "open" },
  C7: { frets: [0, 1, 3, 2, 3, "x"], difficulty: 2.1, family: "open" },
  CM7: { frets: [0, 0, 0, 2, 3, "x"], difficulty: 1.5, family: "open" },
  Cadd9: { frets: [3, 3, 0, 2, 3, "x"], difficulty: 1.7, family: "open" },
  D: { frets: [2, 3, 2, 0, "x", "x"], difficulty: 1.0, family: "open" },
  Dm: { frets: [1, 3, 2, 0, "x", "x"], difficulty: 1.5, family: "open" },
  D7: { frets: [2, 1, 2, 0, "x", "x"], difficulty: 1.4, family: "open" },
  Dm7: { frets: [1, 1, 2, 0, "x", "x"], difficulty: 1.7, family: "open" },
  DM7: { frets: [2, 2, 2, 0, "x", "x"], difficulty: 1.7, family: "open" },
  Dsus2: { frets: [0, 3, 2, 0, "x", "x"], difficulty: 1.2, family: "open" },
  Dsus4: { frets: [3, 3, 2, 0, "x", "x"], difficulty: 1.3, family: "open" },
  E: { frets: [0, 0, 1, 2, 2, 0], difficulty: 1.0, family: "open" },
  Em: { frets: [0, 0, 0, 2, 2, 0], difficulty: 1.0, family: "open" },
  E7: { frets: [0, 0, 1, 0, 2, 0], difficulty: 1.2, family: "open" },
  Em7: { frets: [0, 3, 0, 0, 2, 0], difficulty: 1.6, family: "open" },
  EM7: { frets: [0, 0, 1, 1, 2, 0], difficulty: 2.2, family: "open" },
  Esus4: { frets: [0, 0, 2, 2, 2, 0], difficulty: 1.4, family: "open" },
  F: { frets: [1, 1, 2, 3, 3, 1], difficulty: 3.8, family: "barre" },
  Fm: { frets: [1, 1, 1, 3, 3, 1], difficulty: 3.9, family: "barre" },
  G: { frets: [3, 0, 0, 0, 2, 3], difficulty: 1.2, family: "open" },
  G7: { frets: [1, 0, 0, 0, 2, 3], difficulty: 1.7, family: "open" },
  GM7: { frets: [2, 0, 0, 0, 2, 3], difficulty: 2.0, family: "open" },
  Gsus4: { frets: [3, 1, 0, 0, 3, 3], difficulty: 2.3, family: "open" },
};

function getFingerForOpenShape(shape: string, stringIndex: number): number | undefined {
  const fingers: Record<string, Array<number | undefined>> = {
    A: [undefined, 3, 2, 1, undefined, undefined],
    Am: [undefined, 1, 3, 2, undefined, undefined],
    A7: [undefined, 2, undefined, 1, undefined, undefined],
    Am7: [undefined, 1, undefined, 2, undefined, undefined],
    AM7: [undefined, 3, 1, 2, undefined, undefined],
    C: [undefined, 1, undefined, 2, 3, undefined],
    D: [2, 3, 1, undefined, undefined, undefined],
    Dm: [1, 3, 2, undefined, undefined, undefined],
    D7: [3, 1, 2, undefined, undefined, undefined],
    E: [undefined, undefined, 1, 3, 2, undefined],
    Em: [undefined, undefined, undefined, 3, 2, undefined],
    E7: [undefined, undefined, 1, undefined, 2, undefined],
    Em7: [undefined, 3, undefined, undefined, 2, undefined],
    G: [4, undefined, undefined, undefined, 1, 2],
    G7: [1, undefined, undefined, undefined, 2, 3],
  };

  return fingers[shape]?.[stringIndex];
}

function createPositionsFromFrets(
  frets: Array<number | "x">,
  chord: ChordSegment,
  capo: number,
  fingerResolver?: (stringIndex: number, fret: number | "x") => number | undefined,
): GuitarFingerPosition[] {
  return frets.map((fret, stringIndex) => {
    const guitarString = guitarStrings[stringIndex];
    if (fret === "x") {
      return {
        stringIndex,
        stringLabel: guitarString.label,
        fret,
      };
    }

    const sounded = noteAtFretWithOctave(guitarString.note, guitarString.octave, fret + capo);
    return {
      stringIndex,
      stringLabel: guitarString.label,
      fret,
      note: sounded.note,
      octave: sounded.octave,
      role: roleForPitchClass(sounded.note, chord),
      finger: fingerResolver?.(stringIndex, fret),
    };
  });
}

function rootFretOnString(root: string, stringNote: "E" | "A") {
  const stringPc = pitchClassForNote(stringNote);
  const rootPc = pitchClassForNote(root);
  const fret = (rootPc - stringPc + 12) % 12;
  return fret === 0 ? 12 : fret;
}

function qualityForBarre(chord: ChordSegment) {
  const suffix = getSimpleSuffix(chord);
  if (["", "m", "7", "m7", "M7", "sus4", "sus2", "aug", "dim"].includes(suffix)) {
    return suffix || "major";
  }
  return null;
}

const eShapeVoicings: Record<string, (fret: number) => Array<number | "x">> = {
  major: (fret) => [fret, fret, fret + 1, fret + 2, fret + 2, fret],
  m: (fret) => [fret, fret, fret, fret + 2, fret + 2, fret],
  "7": (fret) => [fret, fret, fret + 1, fret, fret + 2, fret],
  m7: (fret) => [fret, fret, fret, fret, fret + 2, fret],
  M7: (fret) => [fret, fret, fret + 1, fret + 1, fret + 2, fret],
  sus4: (fret) => [fret, fret, fret + 2, fret + 2, fret + 2, fret],
  sus2: (fret) => [fret, fret, fret + 1, fret + 2, fret, fret],
  aug: (fret) => [fret + 1, fret + 1, fret + 1, fret + 2, "x", fret],
  dim: (fret) => [fret + 1, fret, fret + 1, fret, "x", fret],
};

const aShapeVoicings: Record<string, (fret: number) => Array<number | "x">> = {
  major: (fret) => [fret, fret + 2, fret + 2, fret + 2, fret, "x"],
  m: (fret) => [fret, fret + 1, fret + 2, fret + 2, fret, "x"],
  "7": (fret) => [fret, fret + 2, fret, fret + 2, fret, "x"],
  m7: (fret) => [fret, fret + 1, fret, fret + 2, fret, "x"],
  M7: (fret) => [fret, fret + 2, fret + 1, fret + 2, fret, "x"],
  sus4: (fret) => [fret, fret + 3, fret + 2, fret + 2, fret, "x"],
  sus2: (fret) => [fret, fret, fret + 2, fret + 2, fret, "x"],
};

function maxFret(frets: Array<number | "x">) {
  return Math.max(...frets.filter((fret): fret is number => typeof fret === "number"));
}

function fretSpan(frets: Array<number | "x">) {
  const played = frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
  return played.length ? Math.max(...played) - Math.min(...played) : 0;
}

function isPhysicallyPlayable(frets: Array<number | "x">) {
  const span = fretSpan(frets);
  return span <= 4 && maxFret(frets) <= 15;
}

function barreDifficulty(fret: number, quality: string, shape: "E" | "A") {
  const qualityPenalty: Record<string, number> = {
    major: 0.55,
    m: 0.75,
    "7": 0.85,
    m7: 0.95,
    M7: 1.15,
    sus4: 1.0,
    sus2: 0.95,
    aug: 1.5,
    dim: 1.75,
  };
  const fretPenalty = fret <= 5 ? fret * 0.12 : 0.6 + (fret - 5) * 0.25;
  const shapePenalty = shape === "A" ? 0.35 : 0;
  return 3.0 + fretPenalty + shapePenalty + (qualityPenalty[quality] ?? 1.4);
}

function evaluateChordCandidates(chord: ChordSegment, capo: number): VoicingCandidate[] {
  if (!chord.root || chord.label === "N") {
    return [];
  }

  const playedRoot = transposeNote(chord.root, -capo);
  const suffix = getSimpleSuffix(chord);
  const playedShape = shapeLabel(playedRoot, suffix);
  const open = openVoicings[playedShape];
  const candidates: VoicingCandidate[] = [];

  if (open && isPhysicallyPlayable(open.frets)) {
    candidates.push({
      playedShape,
      mode: open.family,
      frets: open.frets,
      difficulty: open.difficulty + capo * 0.03,
      fret: open.family === "barre" ? 1 : 0,
      label: open.family === "open" ? "open shape" : "low-fret shape",
      source: "open",
    });
  }

  const barreQuality = qualityForBarre(chord);
  if (barreQuality) {
    const eFret = rootFretOnString(playedRoot, "E");
    const eFactory = eShapeVoicings[barreQuality];
    if (eFactory) {
      const frets = eFactory(eFret);
      if (isPhysicallyPlayable(frets)) {
        candidates.push({
          playedShape: `${playedRoot}${barreQuality === "major" ? "" : barreQuality} E-shape`,
          mode: "barre",
          frets,
          difficulty: barreDifficulty(eFret, barreQuality, "E") + capo * 0.04,
          fret: eFret,
          label: `E-shape barre at fret ${eFret}`,
          source: "barre-e",
        });
      }
    }

    const aFret = rootFretOnString(playedRoot, "A");
    const aFactory = aShapeVoicings[barreQuality];
    if (aFactory) {
      const frets = aFactory(aFret);
      if (isPhysicallyPlayable(frets)) {
        candidates.push({
          playedShape: `${playedRoot}${barreQuality === "major" ? "" : barreQuality} A-shape`,
          mode: "barre",
          frets,
          difficulty: barreDifficulty(aFret, barreQuality, "A") + capo * 0.04,
          fret: aFret,
          label: `A-shape barre at fret ${aFret}`,
          source: "barre-a",
        });
      }
    }
  }

  return candidates.sort((a, b) => a.difficulty - b.difficulty || a.fret - b.fret);
}

function bestCandidateFor(chord: ChordSegment, capo: number, preferredMode?: GuitarDisplayMode) {
  const candidates = evaluateChordCandidates(chord, capo);
  if (preferredMode) {
    const matching = candidates.find((candidate) => candidate.mode === preferredMode);
    if (matching) {
      return matching;
    }
  }
  return candidates[0] ?? null;
}

export function suggestCapo(
  chords: ChordSegment[],
  mode: CapoSuggestionMode = "balanced",
  maxCapo = maxSuggestedCapo,
): CapoSuggestion {
  const playableChords = chords.filter((chord) => chord.label !== "N" && chord.root);
  const suggestions = Array.from({ length: maxCapo + 1 }, (_, capo) => {
    const chordDifficulties = playableChords.map((chord): ChordDifficulty => {
      const best = bestCandidateFor(chord, capo);
      if (!best) {
        return {
          chord: chord.label,
          playedShape: getPlayedShapeLabel(chord, capo),
          difficulty: 99,
          label: "unsupported",
          mode: "barre",
          fret: 99,
          playable: false,
          reason: "No open or barre voicing available for this quality.",
        };
      }

      return {
        chord: chord.label,
        playedShape: best.playedShape,
        difficulty: best.difficulty,
        label: best.label,
        mode: best.mode,
        fret: best.fret,
        playable: true,
      };
    });
    const impossibleCount = chordDifficulties.filter((entry) => !entry.playable).length;
    const playableDifficulties = chordDifficulties.filter((entry) => entry.playable);
    const easyCount = playableDifficulties.filter((entry) => entry.difficulty <= 2.25).length;
    const hardCount = playableDifficulties.filter((entry) => entry.difficulty >= 4.4).length;
    const averageDifficulty = playableDifficulties.length
      ? playableDifficulties.reduce((sum, entry) => sum + entry.difficulty, 0) /
        playableDifficulties.length
      : 99;
    const capoPenalty =
      mode === "balanced"
        ? capo * 2.4 + Math.max(0, capo - highCapoStart) * 3.8
        : capo * 0.55 + Math.max(0, capo - highCapoStart) * 0.9;
    const hardPenalty = mode === "balanced" ? hardCount * 6.5 : hardCount * 3.2;
    const impossiblePenalty = impossibleCount * 10000;
    const score =
      easyCount * (mode === "balanced" ? 4.2 : 8.5) -
      averageDifficulty * (mode === "balanced" ? 14 : 6) -
      hardPenalty -
      capoPenalty -
      impossiblePenalty;

    return {
      capo,
      mode,
      score,
      easyCount,
      totalCount: playableChords.length,
      easyPercent: playableChords.length ? Math.round((easyCount / playableChords.length) * 100) : 0,
      hardCount,
      impossibleCount,
      averageDifficulty,
      shapeLabels: chordDifficulties.map((entry) => entry.playedShape),
      chordDifficulties,
    };
  });

  const hasPerfectlyPlayableOption = suggestions.some((suggestion) => suggestion.impossibleCount === 0);
  return suggestions
    .filter((suggestion) => !hasPerfectlyPlayableOption || suggestion.impossibleCount === 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.impossibleCount - b.impossibleCount ||
        a.hardCount - b.hardCount ||
        a.capo - b.capo,
    )[0];
}

function findToneFretOnString(
  chord: ChordSegment,
  stringIndex: number,
  minFret: number,
  maxFret: number,
  capo = 0,
) {
  const guitarString = guitarStrings[stringIndex];
  const pitchClasses = chordPitchClasses(chord);
  const candidates = Array.from({ length: maxFret - minFret + 1 }, (_, index) => minFret + index)
    .map((fret) => {
      const sounded = noteAtFretWithOctave(guitarString.note, guitarString.octave, fret + capo);
      const isChordTone = pitchClasses.has(pitchClassForNote(sounded.note));
      const isRoot = normalizeNote(sounded.note) === normalizeNote(chord.root);
      return { fret, sounded, isChordTone, isRoot };
    })
    .filter((candidate) => candidate.isChordTone)
    .sort((a, b) => Number(b.isRoot) - Number(a.isRoot) || a.fret - b.fret);

  return candidates[0];
}

function getToneMapShape(chord: ChordSegment, capo: number, mode: GuitarDisplayMode): GuitarVoicingShape {
  const startFret = mode === "barre" ? Math.max(1, rootFretOnString(chord.root, "E") || 1) : 0;
  const displayFrets =
    mode === "open"
      ? [0, ...Array.from({ length: displayFretCount }, (_, index) => index + 1)]
      : Array.from({ length: displayFretCount }, (_, index) => startFret + index);
  const positions = guitarStrings.map((guitarString, stringIndex) => {
    const candidate = findToneFretOnString(chord, stringIndex, startFret, startFret + displayFretCount - 1, capo);
    if (!candidate) {
      return {
        stringIndex,
        stringLabel: guitarString.label,
        fret: "x" as const,
      };
    }

    return {
      stringIndex,
      stringLabel: guitarString.label,
      fret: candidate.fret,
      note: candidate.sounded.note,
      octave: candidate.sounded.octave,
      role: roleForPitchClass(candidate.sounded.note, chord),
      finger: Math.min(4, Math.max(1, candidate.fret - startFret + 1)),
    };
  });

  return {
    label: chord.label,
    mode,
    capo,
    playedShape: `${chord.label} tones`,
    displayFrets,
    positions,
    playable: false,
    difficulty: 99,
    message:
      mode === "open"
        ? "No safe open/barre voicing found; this is only a chord-tone map."
        : "No safe barre voicing found; this is only a chord-tone map.",
  };
}

function shapeFromCandidate(
  chord: ChordSegment,
  capo: number,
  candidate: VoicingCandidate,
): GuitarVoicingShape {
  const isOpenWindow = candidate.mode === "open" || candidate.fret === 0;
  return {
    label: chord.label,
    mode: candidate.mode,
    capo,
    playedShape: candidate.playedShape,
    displayFrets: isOpenWindow
      ? [0, ...Array.from({ length: displayFretCount }, (_, index) => index + 1)]
      : Array.from({ length: displayFretCount }, (_, offset) => candidate.fret + offset),
    positions: createPositionsFromFrets(candidate.frets, chord, capo, (stringIndex, fret) =>
      candidate.source === "open"
        ? getFingerForOpenShape(candidate.playedShape, stringIndex)
        : fret === candidate.fret
          ? 1
          : typeof fret === "number"
            ? Math.min(4, fret - candidate.fret + 1)
            : undefined,
    ),
    barreFret: candidate.mode === "barre" ? candidate.fret : undefined,
    playable: true,
    difficulty: candidate.difficulty,
    message:
      candidate.mode === "open"
        ? capo > 0
          ? `Play ${candidate.playedShape} with capo ${capo}.`
          : `Play ${candidate.playedShape} open.`
        : `${candidate.label}; difficulty ${candidate.difficulty.toFixed(1)}/5.`,
  };
}

export function getOpenChordShape(chord: ChordSegment, capo: number): GuitarVoicingShape {
  const candidate = bestCandidateFor(chord, capo, "open") ?? bestCandidateFor(chord, capo);
  return candidate ? shapeFromCandidate(chord, capo, candidate) : getToneMapShape(chord, capo, "open");
}

export function getBarreChordShape(chord: ChordSegment, capo: number): GuitarVoicingShape {
  const candidate = bestCandidateFor(chord, capo, "barre") ?? bestCandidateFor(chord, capo);
  return candidate ? shapeFromCandidate(chord, capo, candidate) : getToneMapShape(chord, capo, "barre");
}

export function getGuitarShape(
  chord: ChordSegment,
  mode: GuitarDisplayMode,
  capo: number,
): GuitarVoicingShape {
  return mode === "barre" ? getBarreChordShape(chord, capo) : getOpenChordShape(chord, capo);
}
