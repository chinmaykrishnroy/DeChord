from __future__ import annotations

import re
import shutil
import time
import uuid
from dataclasses import replace
from pathlib import Path
from typing import BinaryIO

from backend.core.config import BackendConfig
from backend.core.database import AnalysisDatabase
from backend.core.media import MediaTools
from backend.core.time import utc_now_iso
from backend.domain.models import (
    VALID_ANALYSIS_MODES,
    AnalysisBatch,
    AnalysisJob,
    ChordSegment,
    Correction,
    Lyrics,
    Song,
    Timeline,
)
from backend.engines.chord import ChordEngine, LvChordiaEngine, build_chord_segment
from backend.engines.key import KeyEngine, MadmomKeyEngine
from backend.engines.tempo import MadmomTempoEngine, TempoEngine
from backend.repositories.analysis_repository import AnalysisRepository
from legacy_desktop.analysis_cache import audio_content_hash


class AnalysisService:
    """Coordinates import, cached analysis jobs, batches, corrections, and exports."""

    def __init__(
        self,
        *,
        config: BackendConfig | None = None,
        repository: AnalysisRepository | None = None,
        chord_engine: ChordEngine | None = None,
        key_engine: KeyEngine | None = None,
        tempo_engine: TempoEngine | None = None,
        media_tools: MediaTools | None = None,
    ) -> None:
        self.config = config or BackendConfig()
        self.config.ensure_directories()
        self.media_tools = media_tools or MediaTools(self.config.work_dir)
        self.repository = repository or AnalysisRepository(AnalysisDatabase(config=self.config))
        self.chord_engine = chord_engine or LvChordiaEngine(config=self.config, media_tools=self.media_tools)
        self.key_engine = key_engine or MadmomKeyEngine()
        self.tempo_engine = tempo_engine or MadmomTempoEngine()

    def import_song(self, path: str, title: str | None = None) -> Song:
        audio_path = Path(path).expanduser()
        if not audio_path.exists():
            raise FileNotFoundError(str(audio_path))

        duration = self.media_tools.probe_duration(audio_path)
        content_hash = audio_content_hash(str(audio_path), engine_id="dechord-song-v1")
        return self.repository.save_song(str(audio_path), content_hash, duration, title=title)

    def import_uploaded_song(self, filename: str, file_obj: BinaryIO) -> Song:
        safe_name = self._safe_upload_name(filename)
        destination = self.config.upload_dir / f"{uuid.uuid4().hex}-{safe_name}"
        with destination.open("wb") as output:
            shutil.copyfileobj(file_obj, output)
        return self.import_song(str(destination), title=Path(filename or safe_name).stem)

    def create_analysis_job(
        self,
        song_id: str,
        *,
        mode: str = "full_song",
        batch_seconds: float | None = None,
        preview_seconds: float | None = None,
        force: bool = False,
        run_immediately: bool = True,
    ) -> AnalysisJob:
        if mode not in VALID_ANALYSIS_MODES:
            raise ValueError(f"Unsupported analysis mode: {mode}")

        song = self._require_song(song_id)
        if mode == "batched" and song.duration is not None and batch_seconds is not None:
            if float(batch_seconds) >= song.duration:
                mode = "full_song"
        normalized_batch_seconds = self._normalize_batch_seconds(mode, batch_seconds)
        normalized_preview_seconds = self._normalize_preview_seconds(mode, preview_seconds)

        if not force:
            cached = self.repository.find_completed_job(
                song_id=song_id,
                mode=mode,
                engine=self.chord_engine.engine_id,
                dictionary=self.config.default_dictionary,
                batch_seconds=normalized_batch_seconds,
                preview_seconds=normalized_preview_seconds,
            )
            if cached is not None:
                self._cleanup_uploaded_media(song)
                return cached

            resumable = self.repository.find_resumable_job(
                song_id=song_id,
                mode=mode,
                engine=self.chord_engine.engine_id,
                dictionary=self.config.default_dictionary,
                batch_seconds=normalized_batch_seconds,
                preview_seconds=normalized_preview_seconds,
            )
            if resumable is not None:
                if not run_immediately:
                    return resumable
                return self._run_job(song, resumable)
        else:
            self.repository.delete_jobs_for_signature(
                song_id=song_id,
                mode=mode,
                engine=self.chord_engine.engine_id,
                dictionary=self.config.default_dictionary,
                batch_seconds=normalized_batch_seconds,
                preview_seconds=normalized_preview_seconds,
            )

        job = self.repository.create_job(
            song_id=song_id,
            mode=mode,
            engine=self.chord_engine.engine_id,
            dictionary=self.config.default_dictionary,
            batch_seconds=normalized_batch_seconds,
            preview_seconds=normalized_preview_seconds,
            force=force,
        )
        if not run_immediately:
            return job
        return self._run_job(song, job)

    def run_job(self, job_id: str) -> AnalysisJob:
        job = self.repository.get_job(job_id)
        if job is None:
            raise KeyError(f"Job not found: {job_id}")
        song = self._require_song(job.song_id)
        return self._run_job(song, job)

    def get_job(self, job_id: str) -> AnalysisJob | None:
        return self.repository.get_job(job_id)

    def get_batches(self, job_id: str) -> list[AnalysisBatch]:
        return self.repository.list_batches(job_id)

    def get_timeline(self, song_id: str) -> Timeline:
        song = self._require_song(song_id)
        job = self.repository.latest_completed_job(song_id)
        if job is None:
            raise KeyError(f"No completed analysis found for song {song_id}")

        return self._timeline_for_job(song, job)

    def get_job_timeline(self, job_id: str) -> Timeline:
        job = self.repository.get_job(job_id)
        if job is None:
            raise KeyError(f"Job not found: {job_id}")
        song = self._require_song(job.song_id)
        return self._timeline_for_job(song, job)

    def _timeline_for_job(self, song: Song, job: AnalysisJob) -> Timeline:
        raw_segments = self.repository.list_segments(job.id)
        corrected_segments = self._apply_corrections(raw_segments, self.repository.list_corrections(song.id))
        batches = self.repository.list_batches(job.id, include_segments=False)
        return Timeline(song=song, job=job, segments=corrected_segments, batches=batches)

    def save_corrections(self, song_id: str, corrections: list[Correction]) -> Timeline:
        self._require_song(song_id)
        for correction in corrections:
            if correction.start < 0 or correction.end <= correction.start:
                raise ValueError("Corrections must use non-negative times with end greater than start.")
        normalized = [
            build_chord_segment(
                correction.start,
                correction.end,
                correction.label,
                corrected=True,
                source="correction",
            )
            for correction in corrections
        ]
        saved = [Correction(segment.start, segment.end, segment.label) for segment in normalized]
        self.repository.replace_corrections(song_id, saved)
        return self.get_timeline(song_id)

    def export_chords(self, song_id: str) -> list[dict[str, str]]:
        timeline = self.get_timeline(song_id)
        return [
            {
                "start": f"{segment.start:.3f}",
                "end": f"{segment.end:.3f}",
                "chord": segment.label,
                "root": segment.root or "",
                "quality": segment.quality or "",
                "notes": " ".join(segment.notes),
                "source": segment.source,
            }
            for segment in timeline.segments
        ]

    def get_lyrics(self, song_id: str) -> Lyrics | None:
        self._require_song(song_id)
        lyrics = self.repository.get_lyrics(song_id)
        if lyrics is None or not self._has_usable_lyrics_text(lyrics.lyrics_text):
            return None
        return lyrics

    def save_lyrics(
        self,
        song_id: str,
        lyrics_text: str,
        *,
        synced: bool,
        source: str,
        provider: str | None = None,
    ) -> Lyrics:
        self._require_song(song_id)
        if not self._has_usable_lyrics_text(lyrics_text):
            raise ValueError("Lyrics text cannot be empty or placeholder text.")
        return self.repository.save_lyrics(
            song_id,
            lyrics_text,
            synced=synced,
            source=source,
            provider=provider,
        )

    def _run_job(self, song: Song, job: AnalysisJob) -> AnalysisJob:
        try:
            self.repository.update_job(job.id, status="running", progress=0.02)
            windows = self._analysis_windows(song, job)
            completed_batches = self.repository.completed_batch_indexes(job.id)

            total = len(windows)
            for batch_index, (start, end) in enumerate(windows):
                if batch_index in completed_batches:
                    progress = 0.1 + (0.85 * ((batch_index + 1) / max(1, total)))
                    self.repository.update_job(job.id, progress=round(progress, 3))
                    continue

                started_at = utc_now_iso()
                monotonic_start = time.perf_counter()
                batch = self._save_batch(job, batch_index, start, end, "running", 0.0, started_at=started_at)
                segments = self._recognize_window(song, job, start, end)
                elapsed_seconds = round(time.perf_counter() - monotonic_start, 3)
                completed_at = utc_now_iso()
                self.repository.save_segments(job.id, batch_index, segments)
                self._save_batch(
                    job,
                    batch.batch_index,
                    batch.start,
                    batch.end,
                    "completed",
                    1.0,
                    started_at=started_at,
                    completed_at=completed_at,
                    elapsed_seconds=elapsed_seconds,
                )
                progress = 0.1 + (0.85 * ((batch_index + 1) / max(1, total)))
                self.repository.update_job(job.id, progress=round(progress, 3))

            key_label = self.key_engine.estimate(song.path)
            tempo_bpm = self.tempo_engine.estimate(song.path)
            completed_job = self.repository.update_job(
                job.id,
                status="completed",
                progress=1.0,
                key_label=key_label,
                tempo_bpm=tempo_bpm,
            )
            self._cleanup_uploaded_media(song)
            return completed_job
        except Exception as exc:
            return self.repository.update_job(job.id, status="failed", progress=1.0, error=str(exc))

    def _analysis_windows(self, song: Song, job: AnalysisJob) -> list[tuple[float, float | None]]:
        duration = song.duration
        if job.mode in {"full_song", "practice"}:
            return [(0.0, duration)]

        if job.mode == "preview":
            preview_seconds = job.preview_seconds or self.config.default_preview_seconds
            end = min(preview_seconds, duration) if duration is not None else preview_seconds
            return [(0.0, end)]

        if job.mode == "batched":
            if duration is None:
                raise RuntimeError("Batched analysis requires a known audio duration.")
            batch_seconds = job.batch_seconds or self.config.default_batch_seconds
            windows: list[tuple[float, float | None]] = []
            start = 0.0
            while start < duration:
                end = min(duration, start + batch_seconds)
                windows.append((round(start, 3), round(end, 3)))
                start = end
            return windows

        raise ValueError(f"Unsupported analysis mode: {job.mode}")

    def _recognize_window(self, song: Song, job: AnalysisJob, start: float, end: float | None) -> list[ChordSegment]:
        if job.mode in {"full_song", "practice"} and start <= 0:
            return self.chord_engine.recognize(song.path)
        if start <= 0 and end is None:
            return self.chord_engine.recognize(song.path)

        target_end = end if end is not None else song.duration
        if target_end is None:
            raise RuntimeError("A duration is required for piece analysis.")

        context_start = start
        context_end = target_end
        if job.mode == "batched":
            padding = max(0.0, self.config.batch_context_seconds)
            context_start = max(0.0, start - padding)
            context_end = min(song.duration or target_end, target_end + padding)

        segments = self.chord_engine.recognize(
            song.path,
            start=context_start,
            duration=max(0.0, context_end - context_start),
        )
        trimmed = self._trim_segments_to_window(segments, start, target_end)
        return self._suppress_boundary_no_chord(trimmed, start)

    def _trim_segments_to_window(
        self,
        segments: list[ChordSegment],
        start: float,
        end: float,
    ) -> list[ChordSegment]:
        trimmed: list[ChordSegment] = []
        for segment in segments:
            clipped_start = max(start, segment.start)
            clipped_end = min(end, segment.end)
            if clipped_end <= clipped_start:
                continue
            trimmed.append(
                replace(
                    segment,
                    start=round(clipped_start, 3),
                    end=round(clipped_end, 3),
                )
            )
        return trimmed

    def _suppress_boundary_no_chord(self, segments: list[ChordSegment], window_start: float) -> list[ChordSegment]:
        if len(segments) < 2:
            return segments
        first, second = segments[0], segments[1]
        if first.label != "N" or first.start > window_start + 0.05:
            return segments
        if first.end - first.start > self.config.leading_no_chord_suppression_seconds:
            return segments
        return [replace(second, start=first.start), *segments[2:]]

    def _save_batch(
        self,
        job: AnalysisJob,
        batch_index: int,
        start: float,
        end: float | None,
        status: str,
        progress: float,
        started_at: str | None = None,
        completed_at: str | None = None,
        elapsed_seconds: float | None = None,
    ) -> AnalysisBatch:
        now = utc_now_iso()
        batch = AnalysisBatch(
            job_id=job.id,
            batch_index=batch_index,
            start=start,
            end=end,
            status=status,
            progress=progress,
            engine=job.engine,
            error=None,
            started_at=started_at,
            completed_at=completed_at,
            elapsed_seconds=elapsed_seconds,
            created_at=now,
            updated_at=now,
        )
        self.repository.save_batch(batch)
        return batch

    def _normalize_batch_seconds(self, mode: str, batch_seconds: float | None) -> float | None:
        if mode != "batched":
            return None
        value = batch_seconds or self.config.default_batch_seconds
        return max(self.config.min_batch_seconds, min(self.config.max_batch_seconds, float(value)))

    def _normalize_preview_seconds(self, mode: str, preview_seconds: float | None) -> float | None:
        if mode != "preview":
            return None
        value = preview_seconds or self.config.default_preview_seconds
        return max(self.config.min_batch_seconds, min(self.config.max_batch_seconds, float(value)))

    def _apply_corrections(self, segments: list[ChordSegment], corrections: list[Correction]) -> list[ChordSegment]:
        if not corrections:
            return segments

        corrected = list(segments)
        for correction in corrections:
            corrected = [
                segment
                for segment in corrected
                if segment.end <= correction.start or segment.start >= correction.end
            ]
            corrected.append(
                build_chord_segment(
                    correction.start,
                    correction.end,
                    correction.label,
                    corrected=True,
                    source="correction",
                )
            )
        corrected.sort(key=lambda segment: (segment.start, segment.end))
        return corrected

    def _require_song(self, song_id: str) -> Song:
        song = self.repository.get_song(song_id)
        if song is None:
            raise KeyError(f"Song not found: {song_id}")
        return song

    def _safe_upload_name(self, filename: str) -> str:
        stem = Path(filename or "audio").stem or "audio"
        suffix = Path(filename or "").suffix or ".audio"
        clean_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip(".-") or "audio"
        clean_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix)[:16] or ".audio"
        return f"{clean_stem[:80]}{clean_suffix}"

    def _has_usable_lyrics_text(self, lyrics_text: str) -> bool:
        body = re.sub(r"\[[^\]]+]", " ", lyrics_text)
        body = re.sub(r"\s+", " ", body).strip()
        if not body:
            return False
        return not re.fullmatch(
            r"(?i)(?:not\s*found|no\s+lyrics?\s+found|lyrics?\s+unavailable|unavailable)",
            body,
        )

    def _cleanup_uploaded_media(self, song: Song) -> None:
        audio_path = Path(song.path)
        try:
            audio_path.relative_to(self.config.upload_dir)
        except ValueError:
            return
        audio_path.unlink(missing_ok=True)
