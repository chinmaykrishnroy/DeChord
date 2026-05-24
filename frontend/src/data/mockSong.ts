import type { ChordSegment, MockSongWorkspace, Voicing } from "../types/music";

const toneSets: Record<string, ChordSegment["tones"]> = {
  "F#": [
    { note: "F#", role: "root" },
    { note: "A#", role: "third" },
    { note: "C#", role: "fifth" },
  ],
  Bsus4: [
    { note: "B", role: "root" },
    { note: "E", role: "third" },
    { note: "F#", role: "fifth" },
  ],
  "C#7": [
    { note: "C#", role: "root" },
    { note: "E#", role: "third" },
    { note: "G#", role: "fifth" },
    { note: "B", role: "seventh" },
  ],
  "D#m7": [
    { note: "D#", role: "root" },
    { note: "F#", role: "third" },
    { note: "A#", role: "fifth" },
    { note: "C#", role: "seventh" },
  ],
  AM7: [
    { note: "A", role: "root" },
    { note: "C#", role: "third" },
    { note: "E", role: "fifth" },
    { note: "G#", role: "seventh" },
  ],
  Eaug: [
    { note: "E", role: "root" },
    { note: "G#", role: "third" },
    { note: "B#", role: "fifth" },
  ],
  Gdim: [
    { note: "G", role: "root" },
    { note: "Bb", role: "third" },
    { note: "Db", role: "fifth" },
  ],
  "F#M7": [
    { note: "F#", role: "root" },
    { note: "A#", role: "third" },
    { note: "C#", role: "fifth" },
    { note: "E#", role: "seventh" },
  ],
};

const rawSegments = [
  ["F#", "major", 0, 12],
  ["Bsus4", "suspended fourth", 12, 24],
  ["C#7", "dominant seventh", 24, 36],
  ["D#m7", "minor seventh", 36, 52],
  ["AM7", "major seventh", 52, 68],
  ["Eaug", "augmented", 68, 84],
  ["F#", "major", 84, 104],
  ["Gdim", "diminished", 104, 120],
  ["C#7", "dominant seventh", 120, 136],
  ["D#m7", "minor seventh", 136, 154],
  ["F#M7", "major seventh", 154, 176],
  ["Bsus4", "suspended fourth", 176, 198],
] as const;

const recommendedVoicings: Voicing[] = [
  {
    id: "guitar-fsharp-easy-capo-2",
    name: "Capo 2, E shape",
    instrument: "guitar",
    fretPositions: [2, 4, 4, 3, 2, 2],
    difficulty: "easy",
  },
  {
    id: "guitar-fsharp-barre",
    name: "2nd fret barre",
    instrument: "guitar",
    fretPositions: [2, 4, 4, 3, 2, 2],
    difficulty: "medium",
  },
  {
    id: "piano-fsharp-root",
    name: "Root position",
    instrument: "piano",
    keys: ["F#", "A#", "C#"],
    difficulty: "easy",
  },
];

export const mockWorkspace: MockSongWorkspace = {
  song: {
    id: "sample-fsharp-session",
    title: "Midnight Practice",
    artist: "Local Demo",
    durationSeconds: 198,
    sourceLabel: "Mock analysis",
  },
  analysis: {
    key: "F# major",
    tempoBpm: 96,
    engine: "local preview",
    status: "mock-ready",
    chordCount: rawSegments.length,
    generatedAt: "preview data",
  },
  chords: rawSegments.map(([label, quality, startSeconds, endSeconds], index) => ({
    id: `segment-${index + 1}`,
    label,
    root: label.match(/^[A-G](?:#|b)?/)?.[0] ?? label,
    quality,
    startSeconds,
    endSeconds,
    tones: toneSets[label],
  })),
  recommendedVoicings,
};
