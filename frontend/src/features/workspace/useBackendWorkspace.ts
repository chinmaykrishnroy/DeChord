import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mockWorkspace } from "../../data/mockSong";
import {
  backendBaseUrl,
  buildEmptyBackendWorkspace,
  buildWorkspaceFromBatches,
  buildWorkspaceFromTimeline,
  checkBackendHealth,
  createAnalysisJob,
  downloadSongLyrics,
  getAnalysisBatches,
  getAnalysisJob,
  getCapabilities,
  getJobTimeline,
  getSongLyrics,
  getSongTimeline,
  listSongs,
  saveCorrections,
  saveSongLyrics,
  songAudioUrl,
  uploadSong,
  type BackendBatch,
  type BackendCapabilities,
  type BackendJob,
  type BackendSong,
} from "../../services/backendClient";
import type {
  AnalysisMode,
  LyricsState,
  SongWorkspace,
} from "../../types/music";
import { emptyLyrics, parseLyrics } from "../../utils/lyrics";
import { extractAlbumArtUrl } from "../../utils/albumArt";
export function useBackendWorkspace() {
  const [workspace, setWorkspace] = useState<SongWorkspace>(mockWorkspace),
    [connectionStatus, setConnectionStatus] = useState<
      "checking" | "online" | "offline"
    >("checking");
  const [workStatus, setWorkStatus] = useState<
    "idle" | "uploading" | "queued" | "analyzing" | "ready" | "failed"
  >("idle");
  const [mode, setMode] = useState<AnalysisMode>("full_song"),
    [batchSeconds, setBatchSeconds] = useState(30),
    [progress, setProgress] = useState(0),
    [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<BackendSong | null>(null),
    [job, setJob] = useState<BackendJob | null>(null),
    [batches, setBatches] = useState<BackendBatch[]>([]);
  const [audioSourceUrl, setAudioSourceUrl] = useState<string | null>(null),
    [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null),
    [analysisVersion, setAnalysisVersion] = useState(0),
    [lyrics, setLyrics] = useState<LyricsState>(emptyLyrics);
  const [library, setLibrary] = useState<BackendSong[]>([]),
    [capabilities, setCapabilities] = useState<BackendCapabilities | null>(
      null,
    );
  const [autoLyrics, setAutoLyrics] = useState(
    () => localStorage.getItem("dechord.autoLyrics") !== "false",
  );
  const run = useRef(0),
    lyricVersion = useRef(0),
    stream = useRef<EventSource | null>(null),
    mounted = useRef(true),
    objectUrl = useRef<string | null>(null),
    artUrl = useRef<string | null>(null);
  const stopStream = useRef<() => void>(() => {});
  const autoLyricsRef = useRef(autoLyrics);
  autoLyricsRef.current = autoLyrics;
  useEffect(() => {
    localStorage.setItem("dechord.autoLyrics", String(autoLyrics));
  }, [autoLyrics]);
  const refreshHealth = useCallback(async () => {
    try {
      await checkBackendHealth();
      if (!mounted.current) return;
      setConnectionStatus("online");
      const [caps, songs] = await Promise.all([getCapabilities(), listSongs()]);
      if (mounted.current) {
        setCapabilities(caps);
        setLibrary(songs);
      }
    } catch {
      if (mounted.current) setConnectionStatus("offline");
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refreshHealth();
    return () => {
      mounted.current = false;
      run.current++;
      lyricVersion.current++;
      stream.current?.close();
      stopStream.current();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      if (artUrl.current) URL.revokeObjectURL(artUrl.current);
    };
  }, [refreshHealth]);
  function active(id: number) {
    return mounted.current && run.current === id;
  }
  const loadLyrics = useCallback(async (current: BackendSong, id: number) => {
    const version = ++lyricVersion.current;
    setLyrics(emptyLyrics);
    try {
      let found = await getSongLyrics(current.id);
      if (!active(id) || version !== lyricVersion.current) return;
      if (!found && autoLyricsRef.current) {
        setLyrics({ ...emptyLyrics, status: "loading" });
        found = await downloadSongLyrics(
          current.id,
          current.title,
          "",
          current.duration ?? 0,
        );
      }
      if (active(id) && version === lyricVersion.current)
        setLyrics(
          found ? parseLyrics(found.lyrics_text, "cache") : emptyLyrics,
        );
    } catch (e) {
      if (active(id) && version === lyricVersion.current)
        setLyrics({
          ...emptyLyrics,
          status: "failed",
          error:
            e instanceof Error
              ? e.message
              : "No lyrics found. You can import an LRC file.",
        });
    }
  }, []);
  const monitor = useCallback(
    async (current: BackendSong, initial: BackendJob, id: number) => {
      const received = new Map<number, BackendBatch>();
      async function publish(next: BackendJob, incoming: BackendBatch[]) {
        if (!active(id)) return true;
        incoming.forEach((b) => received.set(b.batch_index, b));
        const all = [...received.values()].sort(
          (a, b) => a.batch_index - b.batch_index,
        );
        setJob(next);
        setBatches(all);
        setProgress(next.progress);
        setWorkStatus(next.status === "queued" ? "queued" : "analyzing");
        if (incoming.length) {
          setWorkspace(buildWorkspaceFromBatches(current, next, all));
          setAnalysisVersion((v) => v + 1);
        }
        if (next.status === "completed") {
          const timeline = await getJobTimeline(next.id);
          if (active(id)) {
            setWorkspace(buildWorkspaceFromTimeline(timeline));
            setWorkStatus("ready");
            setProgress(1);
            setAnalysisVersion((v) => v + 1);
            void listSongs().then((s) => {
              if (active(id)) setLibrary(s);
            });
          }
          return true;
        }
        if (next.status === "failed" || next.status === "cancelled") {
          setWorkStatus("failed");
          setError(next.error ?? "Analysis failed");
          return true;
        }
        return false;
      }
      if (initial.status === "completed") {
        await publish(initial, []);
        return;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const events = new EventSource(
            `${backendBaseUrl}/analysis/jobs/${initial.id}/events`,
          );
          stream.current = events;
          stopStream.current = () => {
            events.close();
            resolve();
          };
          events.onmessage = (event) => {
            const update = JSON.parse(event.data) as {
              job: BackendJob;
              batches: BackendBatch[];
            };
            void publish(update.job, update.batches)
              .then((done) => {
                if (done) {
                  events.close();
                  resolve();
                }
              })
              .catch(reject);
          };
          events.onerror = () => {
            events.close();
            reject(new Error("Stream interrupted"));
          };
        });
      } catch {
        // Reconnect with one combined local map; full polling is only a compatibility fallback.
        while (active(id)) {
          const [next, all] = await Promise.all([
            getAnalysisJob(initial.id),
            getAnalysisBatches(initial.id),
          ]);
          if (
            await publish(
              next,
              all.filter(
                (b) => b.status === "completed" && !received.has(b.batch_index),
              ),
            )
          )
            break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    },
    [],
  );
  const uploadAndAnalyze = useCallback(
    async (file: File) => {
      const id = ++run.current;
      lyricVersion.current++;
      stream.current?.close();
      stopStream.current();
      setError(null);
      setWorkStatus("uploading");
      setProgress(0);
      setBatches([]);
      setJob(null);
      setSong(null);
      setLyrics(emptyLyrics);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setAudioSourceUrl(objectUrl.current);
      if (artUrl.current) URL.revokeObjectURL(artUrl.current);
      setAlbumArtUrl(null);
      // A useful local player even while analysis is unavailable.
      setWorkspace(
        buildEmptyBackendWorkspace(
          {
            id: file.name,
            path: "",
            title: file.name.replace(/\.[^.]+$/, ""),
            content_hash: "",
            duration: null,
            created_at: new Date().toISOString(),
          },
          "uploading",
        ),
      );
      void extractAlbumArtUrl(file).then((url) => {
        if (active(id)) {
          artUrl.current = url;
          setAlbumArtUrl(url);
        } else if (url) URL.revokeObjectURL(url);
      });
      try {
        await checkBackendHealth();
        if (!active(id)) return;
        setConnectionStatus("online");
        const imported = await uploadSong(file);
        if (!active(id)) return;
        setSong(imported);
        setWorkspace(buildEmptyBackendWorkspace(imported, "queued"));
        setWorkStatus("queued");
        void loadLyrics(imported, id);
        const created = await createAnalysisJob(imported.id, {
          mode,
          batchSeconds,
        });
        if (active(id)) await monitor(imported, created, id);
      } catch (e) {
        if (active(id)) {
          setWorkStatus("failed");
          setError(
            e instanceof Error ? e.message : "Could not analyze this file.",
          );
        }
      }
    },
    [batchSeconds, mode, monitor, loadLyrics],
  );
  const openSong = useCallback(
    async (current: BackendSong) => {
      const id = ++run.current;
      stream.current?.close();
      stopStream.current();
      setSong(current);
      setJob(null);
      setBatches([]);
      setProgress(0);
      setError(null);
      setWorkStatus("analyzing");
      if (objectUrl.current) {
        URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
      }
      setAudioSourceUrl(songAudioUrl(current.id));
      if (artUrl.current) {
        URL.revokeObjectURL(artUrl.current);
        artUrl.current = null;
      }
      setAlbumArtUrl(null);
      if (/\.mp3$/i.test(current.path)) {
        void fetch(songAudioUrl(current.id), {
          headers: { Range: "bytes=0-8388607" },
        })
          .then((response) => {
            if (!response.ok) throw new Error("Artwork unavailable");
            return response.blob();
          })
          .then((blob) =>
            extractAlbumArtUrl(
              new File([blob], "artwork.mp3", { type: "audio/mpeg" }),
            ),
          )
          .then((url) => {
            if (active(id)) {
              artUrl.current = url;
              setAlbumArtUrl(url);
            } else if (url) URL.revokeObjectURL(url);
          })
          .catch(() => {});
      }
      setWorkspace(buildEmptyBackendWorkspace(current, "analyzing"));
      void loadLyrics(current, id);
      try {
        const timeline = await getSongTimeline(current.id);
        if (active(id)) {
          setJob(timeline.job);
          setWorkspace(buildWorkspaceFromTimeline(timeline));
          setProgress(1);
          setWorkStatus("ready");
        }
      } catch {
        try {
          const created = await createAnalysisJob(current.id, {
            mode,
            batchSeconds,
          });
          if (active(id)) await monitor(current, created, id);
        } catch (e) {
          if (active(id)) {
            setWorkStatus("failed");
            setError(String(e));
          }
        }
      }
    },
    [mode, batchSeconds, monitor, loadLyrics],
  );
  const saveLyricsText = useCallback(
    async (
      text: string,
      source: Exclude<LyricsState["source"], "none"> = "manual",
    ) => {
      const version = ++lyricVersion.current;
      const parsed = parseLyrics(text, source);
      setLyrics(parsed);
      if (song && parsed.status === "ready")
        try {
          await saveSongLyrics(song.id, text, parsed.synced, source);
        } catch (e) {
          if (version === lyricVersion.current)
            setLyrics({
              ...parsed,
              error: `Could not save lyrics: ${String(e)}`,
            });
        }
      return parsed;
    },
    [song],
  );
  const importLyricsFile = useCallback(
    async (file: File) => {
      const version = ++lyricVersion.current;
      const text = await file.text();
      if (version !== lyricVersion.current) return emptyLyrics;
      return saveLyricsText(text);
    },
    [saveLyricsText],
  );
  const downloadLyrics = useCallback(
    async (title?: string, artist = "") => {
      if (!song) return null;
      const version = ++lyricVersion.current;
      setLyrics((l) => ({ ...l, status: "loading", error: null }));
      try {
        const result = await downloadSongLyrics(
          song.id,
          title || song.title,
          artist,
          song.duration ?? 0,
        );
        const parsed = parseLyrics(result.lyrics_text, "internet");
        if (version === lyricVersion.current) setLyrics(parsed);
        return parsed;
      } catch (e) {
        if (version === lyricVersion.current)
          setLyrics((l) => ({
            ...l,
            status: l.lines.length ? "ready" : "failed",
            error: String(e),
          }));
        return null;
      }
    },
    [song],
  );
  const correctChord = useCallback(
    async (start: number, end: number, label: string) => {
      if (!song) throw new Error("Import a song before saving corrections.");
      const id = run.current;
      // Full current timeline preserves earlier corrections; backend replaces this saved arrangement.
      const corrections = workspace.chords
        .map((c) => ({
          start: c.startSeconds,
          end: c.endSeconds,
          label: c.label,
        }))
        .filter((c) => c.end <= start || c.start >= end);
      const timeline = await saveCorrections(song.id, [
        ...corrections,
        { start, end, label },
      ]);
      if (active(id)) setWorkspace(buildWorkspaceFromTimeline(timeline));
    },
    [song, workspace.chords],
  );
  const hasAnalysis =
    workspace.chords.length > 0 &&
    workStatus !== "uploading" &&
    workStatus !== "queued";
  const availableUntilSeconds = useMemo(
    () =>
      job?.status === "completed"
        ? workspace.song.durationSeconds
        : Math.max(0, ...workspace.chords.map((c) => c.endSeconds)),
    [job, workspace],
  );
  return {
    workspace,
    connectionStatus,
    workStatus,
    mode,
    batchSeconds,
    progress,
    error,
    song,
    job,
    batches,
    audioSourceUrl,
    albumArtUrl,
    analysisVersion,
    lyrics,
    usingMock: song === null && audioSourceUrl === null,
    hasAnalysis,
    availableUntilSeconds,
    setMode,
    setBatchSeconds,
    uploadAndAnalyze,
    importLyricsFile,
    downloadLyrics,
    saveLyricsText,
    refreshHealth,
    library,
    openSong,
    capabilities,
    autoLyrics,
    setAutoLyrics,
    correctChord,
  };
}
