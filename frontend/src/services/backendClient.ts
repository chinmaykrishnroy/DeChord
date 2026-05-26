import type {
  AnalysisMode,
  AnalysisStatus,
  ChordSegment,
  ChordToneRole,
  SongWorkspace,
} from "../types/music";
import { buildTones, displayChordLabel } from "../utils/musicTheory";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:8765";

export const backendBaseUrl =
  import.meta.env.VITE_DECHORD_BACKEND_URL ?? DEFAULT_BACKEND_URL;

export interface BackendSong {
  id: string;
  path: string;
  title: string;
  content_hash: string;
  duration: number | null;
  created_at: string;
}

export interface BackendJob {
  id: string;
  song_id: string;
  mode: AnalysisMode;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  engine: string;
  dictionary: string | null;
  key_label: string | null;
  tempo_bpm: number | null;
  batch_seconds: number | null;
  preview_seconds: number | null;
  force: boolean;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendChordSegment {
  start: number;
  end: number;
  label: string;
  root: string | null;
  quality: string | null;
  notes: string[];
  intervals: number[];
  bass: string | null;
  confidence: number | null;
  corrected: boolean;
  source: string;
}

export interface BackendBatch {
  job_id: string;
  batch_index: number;
  start: number;
  end: number | null;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  engine: string;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  elapsed_seconds: number | null;
  created_at: string;
  updated_at: string;
  segments: BackendChordSegment[];
}

export interface BackendTimeline {
  song: BackendSong;
  job: BackendJob;
  segments: BackendChordSegment[];
  batches: BackendBatch[];
}

export interface BackendLyrics {
  song_id: string;
  lyrics_text: string;
  synced: boolean;
  source: string;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAnalysisOptions {
  mode: AnalysisMode;
  batchSeconds?: number;
  previewSeconds?: number;
  force?: boolean;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : {
            "Content-Type": "application/json",
            ...init?.headers,
          },
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      // Keep the HTTP status text when the backend sends a non-JSON error.
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export function checkBackendHealth(): Promise<{ status: string }> {
  return requestJson("/health");
}

export function uploadSong(file: File): Promise<BackendSong> {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson("/songs/upload", {
    method: "POST",
    body: formData,
  });
}

export function createAnalysisJob(
  songId: string,
  options: CreateAnalysisOptions,
): Promise<BackendJob> {
  return requestJson("/analysis/jobs", {
    method: "POST",
    body: JSON.stringify({
      song_id: songId,
      mode: options.mode,
      batch_seconds: options.mode === "batched" ? options.batchSeconds : null,
      preview_seconds: options.mode === "preview" ? options.previewSeconds : null,
      force: Boolean(options.force),
    }),
  });
}

export function getAnalysisJob(jobId: string): Promise<BackendJob> {
  return requestJson(`/analysis/jobs/${jobId}`);
}

export async function getAnalysisBatches(jobId: string): Promise<BackendBatch[]> {
  const payload = await requestJson<{ job_id: string; batches: BackendBatch[] }>(
    `/analysis/jobs/${jobId}/batches`,
  );
  return payload.batches;
}

export function getJobTimeline(jobId: string): Promise<BackendTimeline> {
  return requestJson(`/analysis/jobs/${jobId}/timeline`);
}

export async function getSongLyrics(songId: string): Promise<BackendLyrics | null> {
  const payload = await requestJson<{ song_id: string; lyrics: BackendLyrics | null }>(
    `/songs/${songId}/lyrics`,
  );
  return payload.lyrics;
}

export async function saveSongLyrics(
  songId: string,
  lyricsText: string,
  synced: boolean,
  source: "manual" | "internet" | "cache" = "manual",
): Promise<BackendLyrics> {
  const payload = await requestJson<{ song_id: string; lyrics: BackendLyrics }>(
    `/songs/${songId}/lyrics`,
    {
      method: "POST",
      body: JSON.stringify({
        lyrics_text: lyricsText,
        synced,
        source,
        provider: source === "internet" ? "lrclib" : null,
      }),
    },
  );
  return payload.lyrics;
}

export async function downloadSongLyrics(
  songId: string,
  title: string,
  artist: string,
  duration: number,
): Promise<BackendLyrics> {
  const payload = await requestJson<{ song_id: string; lyrics: BackendLyrics }>(
    `/songs/${songId}/lyrics/download`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        artist,
        duration,
      }),
    },
  );
  return payload.lyrics;
}

const toneRoles: ChordToneRole[] = ["root", "third", "fifth", "seventh", "extension"];

function mapJobStatus(status: BackendJob["status"]): AnalysisStatus {
  if (status === "queued") {
    return "queued";
  }
  if (status === "running") {
    return "analyzing";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "idle";
}

function parseRoot(label: string): string {
  return label.match(/^[A-G](?:#|b)?/)?.[0] ?? "";
}

function readableQuality(segment: BackendChordSegment): string {
  if (segment.quality) {
    return segment.quality;
  }
  if (segment.label === "N") {
    return "No chord";
  }
  return "detected";
}

export function backendSegmentToChord(segment: BackendChordSegment, index: number): ChordSegment {
  const label = displayChordLabel(segment.label);
  const root = segment.root ?? parseRoot(label);
  return {
    id: `${index}-${segment.start.toFixed(3)}-${segment.end.toFixed(3)}-${label}`,
    label,
    root,
    quality: readableQuality(segment),
    startSeconds: segment.start,
    endSeconds: segment.end,
    tones:
      segment.notes.length > 0
        ? buildTones(root, segment.notes)
        : segment.notes.map((note, noteIndex) => ({
            note,
            role: toneRoles[Math.min(noteIndex, toneRoles.length - 1)],
          })),
  };
}

export function buildWorkspaceFromTimeline(timeline: BackendTimeline): SongWorkspace {
  const durationSeconds =
    timeline.song.duration ??
    Math.max(1, ...timeline.segments.map((segment) => segment.end));

  return {
    song: {
      id: timeline.song.id,
      title: timeline.song.title,
      artist: "Local file",
      durationSeconds,
      sourceLabel: timeline.song.content_hash.slice(0, 12),
    },
    analysis: {
      key: timeline.job.key_label ?? "Key pending",
      tempoBpm: timeline.job.tempo_bpm,
      engine: timeline.job.engine,
      status: mapJobStatus(timeline.job.status),
      chordCount: timeline.segments.length,
      generatedAt: timeline.job.updated_at,
    },
    chords: timeline.segments.map(backendSegmentToChord),
    recommendedVoicings: [],
  };
}

export function buildWorkspaceFromBatches(
  song: BackendSong,
  job: BackendJob,
  batches: BackendBatch[],
): SongWorkspace {
  const segments = batches
    .filter((batch) => batch.status === "completed")
    .flatMap((batch) => batch.segments)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const durationSeconds =
    song.duration ?? Math.max(1, ...segments.map((segment) => segment.end));

  return {
    song: {
      id: song.id,
      title: song.title,
      artist: "Local file",
      durationSeconds,
      sourceLabel: song.content_hash.slice(0, 12),
    },
    analysis: {
      key: job.key_label ?? "Key pending",
      tempoBpm: job.tempo_bpm,
      engine: job.engine,
      status: mapJobStatus(job.status),
      chordCount: segments.length,
      generatedAt: job.updated_at,
    },
    chords: segments.map(backendSegmentToChord),
    recommendedVoicings: [],
  };
}

export function buildEmptyBackendWorkspace(song: BackendSong, status: AnalysisStatus): SongWorkspace {
  return {
    song: {
      id: song.id,
      title: song.title,
      artist: "Local file",
      durationSeconds: song.duration ?? 1,
      sourceLabel: song.content_hash.slice(0, 12),
    },
    analysis: {
      key: "Key pending",
      tempoBpm: null,
      engine: "local backend",
      status,
      chordCount: 0,
      generatedAt: song.created_at,
    },
    chords: [],
    recommendedVoicings: [],
  };
}
