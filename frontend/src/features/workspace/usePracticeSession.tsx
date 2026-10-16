import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  defaultPractice,
  practiceStorageKey,
  readPracticeBook,
  rememberPractice,
  restorePractice,
  type GuitarPreferences,
  type PracticeSettings,
} from "./practiceSession";

interface Preferences {
  guitar: GuitarPreferences;
  setGuitar: (
    update: (current: GuitarPreferences) => GuitarPreferences,
  ) => void;
  lyricOffset: number;
  setLyricOffset: (offset: number) => void;
}
export const PracticePreferences = createContext<Preferences | null>(null);
export function usePracticePreferences() {
  const context = useContext(PracticePreferences);
  if (!context)
    throw new Error("Practice preferences require the studio provider.");
  return context;
}

function legacyDefaults(): PracticeSettings {
  const settings = defaultPractice();
  try {
    const shapes = localStorage.getItem("dechord.easyShapes");
    return restorePractice({
      ...settings,
      guitar: {
        mode: localStorage.getItem("dechord.guitarMode"),
        capo: Number(localStorage.getItem("dechord.capo")) || 0,
        autoCapo: localStorage.getItem("dechord.autoCapo") !== "false",
        easyShapes: shapes ? JSON.parse(shapes) : settings.guitar.easyShapes,
      },
    });
  } catch {
    return settings;
  }
}

/** One owner for per-song settings; playback position stays outside React's render loop. */
export function usePracticeSession() {
  const [settings, setSettings] = useState(legacyDefaults);
  const [storageError, setStorageError] = useState("");
  const current = useRef(settings);
  const [initialBook] = useState(() => {
    try {
      return readPracticeBook(localStorage.getItem(practiceStorageKey));
    } catch {
      return readPracticeBook(null);
    }
  });
  const book = useRef(initialBook);
  const lastSaved = useRef("");
  const active = useRef<{
    songId: string;
    position: number;
    duration: number;
  } | null>(null);
  const flush = useCallback(() => {
    const track = active.current;
    if (!track) return;
    const practice = restorePractice({
      ...current.current,
      position: track.position,
    });
    const signature = JSON.stringify({ songId: track.songId, practice });
    if (signature === lastSaved.current) return;
    try {
      // Merge other tabs' songs before writing; idle tabs never repeatedly take ownership.
      const latest = readPracticeBook(localStorage.getItem(practiceStorageKey));
      book.current = rememberPractice(
        {
          ...book.current,
          sessions: [
            ...latest.sessions,
            ...book.current.sessions.filter(
              (s) =>
                !latest.sessions.some((other) => other.songId === s.songId),
            ),
          ],
        },
        track.songId,
        practice,
      );
      localStorage.setItem(practiceStorageKey, JSON.stringify(book.current));
      lastSaved.current = signature;
      setStorageError((error) => (error ? "" : error));
    } catch {
      setStorageError(
        "Practice settings could not be saved. Allow local storage or free space before closing the app.",
      );
    }
  }, []);
  const update = useCallback((patch: Partial<PracticeSettings>) => {
    current.current = { ...current.current, ...patch };
    setSettings(current.current);
  }, []);
  const activate = useCallback(
    (songId: string | null, duration: number) => {
      flush();
      const saved = songId
        ? book.current.sessions.find((s) => s.songId === songId)?.practice
        : null;
      const restored = restorePractice(saved ?? legacyDefaults(), duration);
      current.current = restored;
      active.current = songId
        ? { songId, position: restored.position, duration }
        : null;
      lastSaved.current = "";
      setSettings(restored);
      return restored.position;
    },
    [flush],
  );
  const recordPosition = useCallback(
    (songId: string | null, position: number) => {
      const track = active.current;
      if (track?.songId === songId && Number.isFinite(position)) {
        track.position = Math.max(
          0,
          Math.min(track.duration > 0 ? track.duration : Infinity, position),
        );
      }
    },
    [],
  );
  useEffect(() => {
    const timer = window.setInterval(flush, 1000);
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [flush]);
  const setGuitar = useCallback(
    (change: (g: GuitarPreferences) => GuitarPreferences) => {
      update({ guitar: change(current.current.guitar) });
    },
    [update],
  );
  const setLyricOffset = useCallback(
    (lyricOffset: number) => {
      if (Number.isFinite(lyricOffset))
        update({ lyricOffset: Math.max(-30, Math.min(30, lyricOffset)) });
    },
    [update],
  );
  return {
    settings,
    update,
    activate,
    recordPosition,
    storageError,
    lastSongId: initialBook.lastSongId,
    preferences: {
      guitar: settings.guitar,
      setGuitar,
      lyricOffset: settings.lyricOffset,
      setLyricOffset,
    },
  };
}
