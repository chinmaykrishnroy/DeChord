import type { GuitarDisplayMode, LoopRange } from "../../types/music";

export const practiceStorageKey = "dechord.practice.v1";
export type PracticePage =
  "workspace" | "library" | "lyrics" | "settings" | "guitar" | "piano";
export interface GuitarPreferences {
  mode: GuitarDisplayMode;
  capo: number;
  autoCapo: boolean;
  easyShapes: string[];
}
export interface PracticeSettings {
  page: PracticePage;
  tempo: number;
  transpose: number;
  volume: number;
  loop: LoopRange | null;
  lyricOffset: number;
  guitar: GuitarPreferences;
}
export interface SavedPractice extends PracticeSettings {
  position: number;
}
export interface PracticeBook {
  version: 1;
  lastSongId: string | null;
  sessions: Array<{ songId: string; practice: SavedPractice }>;
}
const easyDefaults = [
  "C",
  "D",
  "E",
  "G",
  "A",
  "Am",
  "Em",
  "Dm",
  "A7",
  "D7",
  "E7",
];
const pages: PracticePage[] = [
  "workspace",
  "library",
  "lyrics",
  "settings",
  "guitar",
  "piano",
];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function defaultPractice(): PracticeSettings {
  return {
    page: "workspace",
    tempo: 0,
    transpose: 0,
    volume: 0.8,
    loop: null,
    lyricOffset: 0,
    guitar: {
      mode: "open",
      capo: 0,
      autoCapo: true,
      easyShapes: [...easyDefaults],
    },
  };
}

/** Stored values are untrusted and may outlive the recording or this app version. */
export function restorePractice(
  value: unknown,
  duration = Infinity,
): SavedPractice {
  const raw = record(value),
    guitar = record(raw.guitar),
    loop = record(raw.loop);
  const end = duration > 0 && Number.isFinite(duration) ? duration : Infinity;
  const startSeconds = bounded(loop.startSeconds, 0, 0, end);
  const endSeconds = bounded(loop.endSeconds, 0, 0, end);
  const shapes = Array.isArray(guitar.easyShapes)
    ? [
        ...new Set(
          guitar.easyShapes.filter(
            (s): s is string =>
              typeof s === "string" && s.length > 0 && s.length <= 24,
          ),
        ),
      ].slice(0, 64)
    : [...easyDefaults];
  return {
    page: pages.includes(raw.page as PracticePage)
      ? (raw.page as PracticePage)
      : "workspace",
    position: bounded(raw.position, 0, 0, end),
    tempo: bounded(raw.tempo, 0, -400, 400),
    transpose: Math.round(bounded(raw.transpose, 0, -12, 12)),
    volume: bounded(raw.volume, 0.8, 0, 1),
    lyricOffset: bounded(raw.lyricOffset, 0, -30, 30),
    loop: endSeconds - startSeconds > 0.1 ? { startSeconds, endSeconds } : null,
    guitar: {
      mode: guitar.mode === "barre" ? "barre" : "open",
      capo: Math.round(bounded(guitar.capo, 0, 0, 12)),
      autoCapo: guitar.autoCapo !== false,
      easyShapes: shapes,
    },
  };
}

export function readPracticeBook(text: string | null): PracticeBook {
  const empty: PracticeBook = { version: 1, lastSongId: null, sessions: [] };
  try {
    const raw = record(JSON.parse(text ?? "null"));
    if (raw.version !== 1 || !Array.isArray(raw.sessions)) return empty;
    const seen = new Set<string>();
    const sessions: PracticeBook["sessions"] = [];
    for (const item of raw.sessions.slice(0, 50)) {
      const entry = record(item);
      if (
        typeof entry.songId !== "string" ||
        !entry.songId ||
        entry.songId.length > 256 ||
        seen.has(entry.songId)
      )
        continue;
      seen.add(entry.songId);
      sessions.push({
        songId: entry.songId,
        practice: restorePractice(entry.practice),
      });
    }
    return {
      version: 1,
      sessions,
      lastSongId:
        typeof raw.lastSongId === "string" && seen.has(raw.lastSongId)
          ? raw.lastSongId
          : null,
    };
  } catch {
    return empty;
  }
}

export function rememberPractice(
  book: PracticeBook,
  songId: string,
  practice: SavedPractice,
): PracticeBook {
  return {
    version: 1,
    lastSongId: songId,
    sessions: [
      { songId, practice: restorePractice(practice) },
      ...book.sessions.filter((s) => s.songId !== songId),
    ].slice(0, 50),
  };
}
