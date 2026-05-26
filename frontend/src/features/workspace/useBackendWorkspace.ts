import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { mockWorkspace } from "../../data/mockSong";
import {
  buildEmptyBackendWorkspace,
  buildWorkspaceFromBatches,
  buildWorkspaceFromTimeline,
  checkBackendHealth,
  createAnalysisJob,
  downloadSongLyrics,
  getAnalysisBatches,
  getAnalysisJob,
  getJobTimeline,
  getSongLyrics,
  saveSongLyrics,
  uploadSong,
  type BackendBatch,
  type BackendJob,
  type BackendSong,
} from "../../services/backendClient";
import type { AnalysisMode, LyricsState, SongWorkspace } from "../../types/music";
import { extractAlbumArtUrl } from "../../utils/albumArt";
import { emptyLyrics, parseLyrics } from "../../utils/lyrics";

type BackendConnectionStatus = "checking" | "online" | "offline";
type BackendWorkStatus = "idle" | "uploading" | "queued" | "analyzing" | "ready" | "failed";

const pollDelayMs = 1000;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function maxSegmentEnd(workspace: SongWorkspace) {
  return workspace.chords.reduce(
    (max, chord) => Math.max(max, chord.endSeconds),
    0,
  );
}

export function useBackendWorkspace() {
  const [workspace, setWorkspace] = useState<SongWorkspace>(mockWorkspace);
  const [connectionStatus, setConnectionStatus] = useState<BackendConnectionStatus>("checking");
  const [workStatus, setWorkStatus] = useState<BackendWorkStatus>("idle");
  const [mode, setMode] = useState<AnalysisMode>("full_song");
  const [batchSeconds, setBatchSeconds] = useState(30);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<BackendSong | null>(null);
  const [job, setJob] = useState<BackendJob | null>(null);
  const [batches, setBatches] = useState<BackendBatch[]>([]);
  const [audioSourceUrl, setAudioSourceUrl] = useState<string | null>(null);
  const [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [lyrics, setLyrics] = useState<LyricsState>(emptyLyrics);
  const audioSourceUrlRef = useRef<string | null>(null);
  const albumArtUrlRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const lyricsVersionRef = useRef(0);
  const mountedRef = useRef(true);

  const refreshHealth = useCallback(async () => {
    setConnectionStatus("checking");
    try {
      await checkBackendHealth();
      if (mountedRef.current) {
        setConnectionStatus("online");
      }
    } catch {
      if (mountedRef.current) {
        setConnectionStatus("offline");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refreshHealth();

    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      if (audioSourceUrlRef.current) {
        URL.revokeObjectURL(audioSourceUrlRef.current);
        audioSourceUrlRef.current = null;
      }
      if (albumArtUrlRef.current) {
        URL.revokeObjectURL(albumArtUrlRef.current);
        albumArtUrlRef.current = null;
      }
    };
  }, [refreshHealth]);

  const publishPartialWorkspace = useCallback(
    (currentSong: BackendSong, currentJob: BackendJob, currentBatches: BackendBatch[]) => {
      const nextWorkspace = buildWorkspaceFromBatches(currentSong, currentJob, currentBatches);
      if (nextWorkspace.chords.length > 0) {
        setWorkspace(nextWorkspace);
        setAnalysisVersion((current) => current + 1);
      } else {
        setWorkspace(buildEmptyBackendWorkspace(currentSong, "analyzing"));
      }
    },
    [],
  );

  const pollJob = useCallback(
    async (currentSong: BackendSong, initialJob: BackendJob, activeRunId: number) => {
      let currentJob = initialJob;

      while (mountedRef.current && runIdRef.current === activeRunId) {
        currentJob = await getAnalysisJob(initialJob.id);
        const currentBatches = await getAnalysisBatches(initialJob.id);

        if (!mountedRef.current || runIdRef.current !== activeRunId) {
          return;
        }

        setJob(currentJob);
        setBatches(currentBatches);
        setProgress(currentJob.progress);
        setWorkStatus(currentJob.status === "completed" ? "ready" : "analyzing");
        publishPartialWorkspace(currentSong, currentJob, currentBatches);

        if (currentJob.status === "completed") {
          const timeline = await getJobTimeline(currentJob.id);
          if (!mountedRef.current || runIdRef.current !== activeRunId) {
            return;
          }
          setWorkspace(buildWorkspaceFromTimeline(timeline));
          setProgress(1);
          setWorkStatus("ready");
          setAnalysisVersion((current) => current + 1);
          return;
        }

        if (currentJob.status === "failed" || currentJob.status === "cancelled") {
          setWorkStatus("failed");
          setError(currentJob.error ?? "Analysis failed.");
          return;
        }

        await wait(pollDelayMs);
      }
    },
    [publishPartialWorkspace],
  );

  const uploadAndAnalyze = useCallback(
    async (file: File) => {
      const activeRunId = runIdRef.current + 1;
      runIdRef.current = activeRunId;
      setError(null);
      setProgress(0);
      setBatches([]);
      setWorkStatus("uploading");
      if (audioSourceUrlRef.current) {
        URL.revokeObjectURL(audioSourceUrlRef.current);
      }
      const nextAudioSourceUrl = URL.createObjectURL(file);
      audioSourceUrlRef.current = nextAudioSourceUrl;
      setAudioSourceUrl(nextAudioSourceUrl);
      if (albumArtUrlRef.current) {
        URL.revokeObjectURL(albumArtUrlRef.current);
        albumArtUrlRef.current = null;
      }
      setAlbumArtUrl(null);

      void extractAlbumArtUrl(file).then((nextAlbumArtUrl) => {
        if (!mountedRef.current || runIdRef.current !== activeRunId) {
          if (nextAlbumArtUrl) {
            URL.revokeObjectURL(nextAlbumArtUrl);
          }
          return;
        }

        albumArtUrlRef.current = nextAlbumArtUrl;
        setAlbumArtUrl(nextAlbumArtUrl);
      });

      try {
        if (connectionStatus !== "online") {
          await checkBackendHealth();
          if (!mountedRef.current || runIdRef.current !== activeRunId) {
            return;
          }
          setConnectionStatus("online");
        }

        const importedSong = await uploadSong(file);
        if (!mountedRef.current || runIdRef.current !== activeRunId) {
          return;
        }

      setSong(importedSong);
      setWorkspace(buildEmptyBackendWorkspace(importedSong, "queued"));
      const lyricsCacheVersion = lyricsVersionRef.current + 1;
      lyricsVersionRef.current = lyricsCacheVersion;
      setLyrics(emptyLyrics);
      setWorkStatus("queued");

      void getSongLyrics(importedSong.id)
        .then((storedLyrics) => {
          if (
            storedLyrics &&
            mountedRef.current &&
            runIdRef.current === activeRunId &&
            lyricsVersionRef.current === lyricsCacheVersion
          ) {
            const parsed = parseLyrics(storedLyrics.lyrics_text, "cache");
            setLyrics(parsed.status === "ready" ? parsed : emptyLyrics);
          }
        })
        .catch(() => undefined);

        const createdJob = await createAnalysisJob(importedSong.id, {
          mode,
          batchSeconds,
          force: false,
        });
        if (!mountedRef.current || runIdRef.current !== activeRunId) {
          return;
        }

        setJob(createdJob);
        setProgress(createdJob.progress);
        await pollJob(importedSong, createdJob, activeRunId);
      } catch (caught) {
        if (!mountedRef.current || runIdRef.current !== activeRunId) {
          return;
        }
        setWorkStatus("failed");
        setConnectionStatus("offline");
        setError(caught instanceof Error ? caught.message : "Backend request failed.");
      }
    },
    [batchSeconds, connectionStatus, mode, pollJob],
  );

  const saveLyricsText = useCallback(
    async (lyricsText: string, source: Exclude<LyricsState["source"], "none"> = "manual") => {
      const lyricsEditVersion = lyricsVersionRef.current + 1;
      lyricsVersionRef.current = lyricsEditVersion;
      const parsed = parseLyrics(lyricsText, source);
      if (parsed.status !== "ready") {
        const emptyState: LyricsState = {
          ...parsed,
          status: "failed",
          error: "No usable lyrics found in this file.",
        };
        if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
          setLyrics(emptyState);
        }
        return emptyState;
      }

      if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
        setLyrics(parsed);
      }
      if (!song || connectionStatus !== "online") {
        return parsed;
      }

      try {
        const saved = await saveSongLyrics(song.id, lyricsText, parsed.synced, source);
        const cached = parseLyrics(saved.lyrics_text, source);
        if (cached.status === "ready") {
          if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
            setLyrics(cached);
          }
          return cached;
        }
        return parsed;
      } catch (caught) {
        const localOnly: LyricsState = {
          ...parsed,
          error: caught instanceof Error ? `Lyrics visible locally, but could not be saved: ${caught.message}` : "Lyrics visible locally, but could not be saved.",
        };
        if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
          setLyrics(localOnly);
        }
        return localOnly;
      }
    },
    [connectionStatus, song],
  );

  const importLyricsFile = useCallback(
    async (file: File) => {
      lyricsVersionRef.current += 1;
      setLyrics((current) => ({ ...current, status: "loading", error: null }));
      const text = await file.text();
      return saveLyricsText(text, "manual");
    },
    [saveLyricsText],
  );

  const downloadLyrics = useCallback(async () => {
    if (!song || connectionStatus !== "online") {
      setLyrics((current) => ({
        ...current,
        status: current.status === "ready" ? "ready" : "failed",
        error: "Lyrics download needs an analyzed local song and the backend online.",
      }));
      return null;
    }

    const lyricsEditVersion = lyricsVersionRef.current + 1;
    lyricsVersionRef.current = lyricsEditVersion;
    const previousLyrics = lyrics;
    setLyrics((current) => ({ ...current, status: "loading", error: null }));
    try {
      const downloaded = await downloadSongLyrics(
        song.id,
        workspace.song.title,
        workspace.song.artist,
        workspace.song.durationSeconds,
      );
      const parsed = parseLyrics(downloaded.lyrics_text, "internet");
      if (parsed.status !== "ready") {
        throw new Error("No usable lyrics found.");
      }
      if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
        setLyrics(parsed);
      }
      return parsed;
    } catch (caught) {
      if (mountedRef.current && lyricsVersionRef.current === lyricsEditVersion) {
        const message = caught instanceof Error ? caught.message : "No lyrics found.";
        setLyrics((current) =>
          previousLyrics.status === "ready"
            ? { ...previousLyrics, error: message }
            : { ...current, status: "failed", error: message },
        );
      }
      return null;
    }
  }, [connectionStatus, lyrics, song, workspace.song.artist, workspace.song.durationSeconds, workspace.song.title]);

  const hasAnalysis = workspace.chords.length > 0 && workStatus !== "uploading" && workStatus !== "queued";
  const availableUntilSeconds = useMemo(() => {
    if (!hasAnalysis) {
      return 0;
    }
    if (job?.status === "completed") {
      return workspace.song.durationSeconds;
    }
    return maxSegmentEnd(workspace);
  }, [hasAnalysis, job?.status, workspace]);

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
    usingMock: song === null,
    hasAnalysis,
    availableUntilSeconds,
    setMode,
    setBatchSeconds,
    uploadAndAnalyze,
    importLyricsFile,
    downloadLyrics,
    saveLyricsText,
    refreshHealth,
  };
}
