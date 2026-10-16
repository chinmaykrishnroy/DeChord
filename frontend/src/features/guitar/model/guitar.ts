import type {
  ChordSegment,
  ChordTone,
  GuitarDisplayMode,
} from "../../../types/music";
import {
  chordPitchClasses,
  chromaticNotes,
  normalizeNote,
  pitchClassForNote,
  roleForPitchClass,
  transposeChordLabel,
  transposeNote,
} from "../../../utils/musicTheory";
import { openVoicings } from "./voicings";
export { chromaticNotes, normalizeNote, transposeNote };
// High e to low E, as seen looking down at a right-handed guitar.
export const guitarStrings = [
  { label: "e", note: "E", octave: 4 },
  { label: "B", note: "B", octave: 3 },
  { label: "G", note: "G", octave: 3 },
  { label: "D", note: "D", octave: 3 },
  { label: "A", note: "A", octave: 2 },
  { label: "E", note: "E", octave: 2 },
];
type Fret = number | "x";
export interface GuitarFingerPosition {
  stringIndex: number;
  stringLabel: string;
  fret: Fret;
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
  barreStrings?: [number, number];
  message: string;
  playable: boolean;
  difficulty: number;
  id?: string;
}
interface Candidate {
  frets: Fret[];
  fingers: (number | undefined)[];
  barre?: number;
  barreStrings?: [number, number];
  score: number;
  mode: GuitarDisplayMode;
}
const cache = new Map<string, Candidate[]>();
function sounded(index: number, fret: number, capo: number) {
  const s = guitarStrings[index],
    midi = (s.octave + 1) * 12 + pitchClassForNote(s.note) + fret + capo;
  return {
    note: chromaticNotes[midi % 12],
    octave: Math.floor(midi / 12) - 1,
    midi,
  };
}
export function getNoteAtFret(note: string, fret: number) {
  return transposeNote(note, fret);
}
export function getPlayedShapeLabel(chord: ChordSegment, capo: number) {
  return transposeChordLabel(chord.label, -capo);
}
function validate(
  frets: Fret[],
  chord: ChordSegment,
  capo: number,
  curated = false,
): Candidate | null {
  const pcs = chordPitchClasses(chord),
    slash = chord.label.match(/\/([A-G][#b]?)$/)?.[1],
    bass = pitchClassForNote(slash ?? chord.root);
  if (slash) pcs.add(bass);
  const played = frets.flatMap((f, i) =>
    f === "x" ? [] : [{ i, f, ...sounded(i, f, capo) }],
  );
  if (played.length < 3 || !played.every((p) => pcs.has(p.midi % 12)))
    return null;
  const coverage = new Set(played.map((p) => p.midi % 12));
  if (
    [...pcs].some((pc) => !coverage.has(pc)) ||
    played.reduce((a, b) => (a.midi < b.midi ? a : b)).midi % 12 !== bass
  )
    return null;
  const pressed = played.filter((p) => p.f > 0),
    min = pressed.length ? Math.min(...pressed.map((p) => p.f)) : 0,
    max = pressed.length ? Math.max(...pressed.map((p) => p.f)) : 0;
  if (max - min > 3 || max + capo > 15) return null;
  const atBase = pressed.filter((p) => p.f === min).map((p) => p.i),
    first = Math.min(...atBase),
    last = Math.max(...atBase);
  const barre =
    // D, A and similar shapes can use independent fingers even when two
    // notes happen to share a fret. Require a barre only above four fingers.
    pressed.length > 4 &&
    atBase.length >= 2 &&
    frets.slice(first, last + 1).every((f) => typeof f === "number" && f >= min)
      ? min
      : undefined;
  const groups = pressed.length - (barre ? atBase.length - 1 : 0);
  if (groups > 4) return null;
  const fingers: (number | undefined)[] = Array(6).fill(undefined);
  let next = barre ? 2 : 1;
  for (const p of [...pressed].sort((a, b) => a.f - b.f || b.i - a.i))
    fingers[p.i] = barre && p.f === barre ? 1 : next++;
  const opens = played.filter((p) => p.f === 0).length,
    innerMutes = frets
      .slice(played[0].i, played[played.length - 1].i + 1)
      .filter((f) => f === "x").length;
  const score =
    groups * 0.48 +
    (max - min) * 0.33 +
    max * 0.08 +
    (barre ? 1.35 : 0) +
    innerMutes * 1.5 +
    (6 - played.length) * 0.12 -
    opens * 0.12 -
    (curated ? 0.65 : 0);
  return {
    frets: [...frets],
    fingers,
    barre,
    barreStrings: barre ? [first, last] : undefined,
    score,
    mode: barre ? "barre" : "open",
  };
}
function candidates(chord: ChordSegment, capo: number) {
  const key = JSON.stringify([chord.label, chord.root, chord.tones, capo]),
    cached = cache.get(key);
  if (cached) return cached;
  if (!chord.root || chord.label === "N") return [];
  const results: Candidate[] = [],
    seen = new Set<string>();
  function add(frets: Fret[], curated = false) {
    const id = frets.join(",");
    if (seen.has(id)) return;
    seen.add(id);
    const c = validate(frets, chord, capo, curated);
    if (c) results.push(c);
  }
  const curated = openVoicings[getPlayedShapeLabel(chord, capo).split("/")[0]];
  if (curated) add(curated.frets, true);
  const pcs = chordPitchClasses(chord),
    bass = chord.label.match(/\/([A-G][#b]?)$/)?.[1];
  if (bass) pcs.add(pitchClassForNote(bass));
  // Bounded four-fret hand positions; every candidate must pass pitch, bass, span and finger checks.
  for (let base = 1; base <= 9; base++) {
    const options = guitarStrings.map((_, i): Fret[] => [
      "x",
      ...Array.from({ length: 4 }, (_, j) => base + j).filter(
        (f) => f + capo <= 15 && pcs.has(sounded(i, f, capo).midi % 12),
      ),
      ...(pcs.has(sounded(i, 0, capo).midi % 12) ? [0] : []),
    ]);
    function visit(index: number, frets: Fret[], count: number) {
      if (count + 6 - index < 3) return;
      if (index === 6) {
        add(frets);
        return;
      }
      for (const f of options[index])
        visit(index + 1, [...frets, f], count + (f === "x" ? 0 : 1));
    }
    visit(0, [], 0);
  }
  results.sort(
    (a, b) =>
      a.score - b.score || a.frets.join(",").localeCompare(b.frets.join(",")),
  );
  if (cache.size > 512) cache.clear();
  cache.set(key, results);
  return results;
}
function toShape(
  chord: ChordSegment,
  capo: number,
  mode: GuitarDisplayMode,
  c?: Candidate,
): GuitarVoicingShape {
  if (!c)
    return {
      label: chord.label,
      mode,
      capo,
      playedShape: getPlayedShapeLabel(chord, capo),
      displayFrets: [0, 1, 2, 3, 4, 5],
      positions: guitarStrings.map((s, i) => ({
        stringIndex: i,
        stringLabel: s.label,
        fret: "x",
      })),
      playable: false,
      difficulty: 5,
      message: `No verified ${mode === "open" ? "open or compact" : "barre"} shape. Try another mode or capo.`,
    };
  const fretted = c.frets.filter(
      (f): f is number => typeof f === "number" && f > 0,
    ),
    min = fretted.length ? Math.min(...fretted) : 1,
    start = min <= 2 ? 1 : min;
  return {
    id: c.frets.join("-"),
    label: chord.label,
    mode: c.mode,
    capo,
    playedShape: getPlayedShapeLabel(chord, capo),
    displayFrets: [
      ...(start === 1 ? [0] : []),
      ...Array.from({ length: 5 }, (_, i) => start + i),
    ],
    barreFret: c.barre,
    barreStrings: c.barreStrings,
    positions: c.frets.map((f, i) => ({
      stringIndex: i,
      stringLabel: guitarStrings[i].label,
      fret: f,
      ...(f === "x"
        ? {}
        : {
            ...sounded(i, f, capo),
            finger: c.fingers[i],
            role: roleForPitchClass(sounded(i, f, capo).note, chord),
          }),
    })),
    playable: true,
    difficulty: Math.min(5, Math.max(1, c.score)),
    message: `${c.barre ? "Index barre" : "Independent fingers"} · ${capo ? `capo ${capo}, relative frets` : "standard tuning"} · ${c.score < 2.5 ? "easy" : c.score < 3.8 ? "moderate" : "stretch"}`,
  };
}
export function getGuitarVoicings(
  chord: ChordSegment,
  mode: GuitarDisplayMode,
  capo = 0,
) {
  return candidates(chord, capo)
    .filter((c) => c.mode === mode)
    .slice(0, 8)
    .map((c) => toShape(chord, capo, mode, c));
}
export function getGuitarShape(
  chord: ChordSegment,
  mode: GuitarDisplayMode,
  capo = 0,
): GuitarVoicingShape {
  return getGuitarVoicings(chord, mode, capo)[0] ?? toShape(chord, capo, mode);
}
export function getOpenChordShape(chord: ChordSegment, capo = 0) {
  return getGuitarShape(chord, "open", capo);
}
export function getBarreChordShape(chord: ChordSegment, capo = 0) {
  return getGuitarShape(chord, "barre", capo);
}
