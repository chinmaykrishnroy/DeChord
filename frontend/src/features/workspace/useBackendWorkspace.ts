import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { mockWorkspace } from "../../data/mockSong";
import {
  buildEmptyBackendWorkspace,
  buildWorkspaceFromBatches,
  buildWorkspaceFromTimeline,
  checkBackendHealth,
  createAnalysisJob,
  getAnalysisBatches,
  getAnalysisJob,
  getJobTimeline,
  uploadSong,
  type BackendBatch,
  type BackendJob,
  type BackendSong,
} from "../../services/backendClient";
import type { AnalysisMode, SongWorkspace } from "../../types/music";

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
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const audioSourceUrlRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
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
        setWorkStatus("queued");

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
    analysisVersion,
    usingMock: song === null,
    hasAnalysis,
    availableUntilSeconds,
    setMode,
    setBatchSeconds,
    uploadAndAnalyze,
    refreshHealth,
  };
}
