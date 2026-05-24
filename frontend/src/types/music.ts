export type InstrumentTab = "guitar" | "piano";

export type GuitarDisplayMode = "open" | "barre";

export type CapoSuggestionMode = "balanced" | "easy";

export type ThemeMode = "dark" | "light";

export type AnalysisStatus =
  | "mock-ready"
  | "idle"
  | "uploading"
  | "queued"
  | "analyzing"
  | "cached"
  | "completed"
  | "failed"
  | "offline";

export type AnalysisMode = "full_song" | "preview" | "batched" | "practice";

export type ChordToneRole = "root" | "third" | "fifth" | "seventh" | "extension";

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  sourceLabel: string;
}

export interface ChordTone {
  note: string;
  role: ChordToneRole;
}

export interface ChordSegment {
  id: string;
  label: string;
  root: string;
  quality: string;
  startSeconds: number;
  endSeconds: number;
  tones: ChordTone[];
}

export interface AnalysisSummary {
  key: string;
  tempoBpm: number | null;
  engine: string;
  status: AnalysisStatus;
  chordCount: number;
  generatedAt: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTimeSeconds: number;
  durationSeconds: number;
}

export interface Voicing {
  id: string;
  name: string;
  instrument: InstrumentTab;
  fretPositions?: Array<number | "x">;
  keys?: string[];
  difficulty: "easy" | "medium" | "advanced";
}

export interface SongWorkspace {
  song: SongSummary;
  analysis: AnalysisSummary;
  chords: ChordSegment[];
  recommendedVoicings: Voicing[];
}

export type MockSongWorkspace = SongWorkspace;

export interface ThemeSettings {
  mode: ThemeMode;
  hue: number;
  instrumentSoundsEnabled: boolean;
}
