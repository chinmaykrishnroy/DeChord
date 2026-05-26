from __future__ import annotations

import json
import uuid
from pathlib import Path

from backend.core.database import AnalysisDatabase
from backend.core.time import utc_now_iso
from backend.domain.models import AnalysisBatch, AnalysisJob, ChordSegment, Correction, Lyrics, Song
from legacy_desktop.chord_types import normalize_chord_label


class AnalysisRepository:
    def __init__(self, database: AnalysisDatabase) -> None:
        self.database = database

    def save_song(self, path: str, content_hash: str, duration: float | None, title: str | None = None) -> Song:
        song_title = title or Path(path).stem
        song_id = content_hash[:16]
        now = utc_now_iso()
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM songs WHERE content_hash = ?",
                (content_hash,),
            ).fetchone()
            if row:
                connection.execute(
                    "UPDATE songs SET path = ?, title = ?, duration = ? WHERE id = ?",
                    (path, song_title, duration, row["id"]),
                )
                return self._song_from_row(connection.execute("SELECT * FROM songs WHERE id = ?", (row["id"],)).fetchone())

            connection.execute(
                """
                INSERT INTO songs(id, path, title, content_hash, duration, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (song_id, path, song_title, content_hash, duration, now),
            )
            return self._song_from_row(connection.execute("SELECT * FROM songs WHERE id = ?", (song_id,)).fetchone())

    def get_song(self, song_id: str) -> Song | None:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM songs WHERE id = ?", (song_id,)).fetchone()
            return self._song_from_row(row) if row else None

    def create_job(
        self,
        song_id: str,
        mode: str,
        engine: str,
        dictionary: str | None,
        batch_seconds: float | None,
        preview_seconds: float | None,
        force: bool,
    ) -> AnalysisJob:
        now = utc_now_iso()
        job_id = uuid.uuid4().hex
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO analysis_jobs(
                    id, song_id, mode, status, progress, engine, dictionary,
                    batch_seconds, preview_seconds, force, created_at, updated_at
                )
                VALUES (?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    song_id,
                    mode,
                    engine,
                    dictionary,
                    batch_seconds,
                    preview_seconds,
                    1 if force else 0,
                    now,
                    now,
                ),
            )
            return self._job_from_row(connection.execute("SELECT * FROM analysis_jobs WHERE id = ?", (job_id,)).fetchone())

    def update_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: float | None = None,
        key_label: str | None = None,
        tempo_bpm: float | None = None,
        error: str | None = None,
    ) -> AnalysisJob:
        current = self.get_job(job_id)
        if current is None:
            raise KeyError(job_id)

        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE analysis_jobs
                SET status = ?, progress = ?, key_label = COALESCE(?, key_label),
                    tempo_bpm = COALESCE(?, tempo_bpm), error = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    status or current.status,
                    current.progress if progress is None else progress,
                    key_label,
                    tempo_bpm,
                    error,
                    utc_now_iso(),
                    job_id,
                ),
            )
            return self._job_from_row(connection.execute("SELECT * FROM analysis_jobs WHERE id = ?", (job_id,)).fetchone())

    def get_job(self, job_id: str) -> AnalysisJob | None:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM analysis_jobs WHERE id = ?", (job_id,)).fetchone()
            return self._job_from_row(row) if row else None

    def find_completed_job(
        self,
        song_id: str,
        mode: str,
        engine: str,
        dictionary: str | None,
        batch_seconds: float | None,
        preview_seconds: float | None,
    ) -> AnalysisJob | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM analysis_jobs
                WHERE song_id = ? AND mode = ? AND engine = ?
                  AND COALESCE(dictionary, '') = COALESCE(?, '')
                  AND COALESCE(batch_seconds, -1) = COALESCE(?, -1)
                  AND COALESCE(preview_seconds, -1) = COALESCE(?, -1)
                  AND status = 'completed'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (song_id, mode, engine, dictionary, batch_seconds, preview_seconds),
            ).fetchone()
            return self._job_from_row(row) if row else None

    def find_resumable_job(
        self,
        song_id: str,
        mode: str,
        engine: str,
        dictionary: str | None,
        batch_seconds: float | None,
        preview_seconds: float | None,
    ) -> AnalysisJob | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM analysis_jobs
                WHERE song_id = ? AND mode = ? AND engine = ?
                  AND COALESCE(dictionary, '') = COALESCE(?, '')
                  AND COALESCE(batch_seconds, -1) = COALESCE(?, -1)
                  AND COALESCE(preview_seconds, -1) = COALESCE(?, -1)
                  AND status IN ('queued', 'running', 'failed')
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (song_id, mode, engine, dictionary, batch_seconds, preview_seconds),
            ).fetchone()
            return self._job_from_row(row) if row else None

    def delete_jobs_for_signature(
        self,
        song_id: str,
        mode: str,
        engine: str,
        dictionary: str | None,
        batch_seconds: float | None,
        preview_seconds: float | None,
    ) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                DELETE FROM analysis_jobs
                WHERE song_id = ? AND mode = ? AND engine = ?
                  AND COALESCE(dictionary, '') = COALESCE(?, '')
                  AND COALESCE(batch_seconds, -1) = COALESCE(?, -1)
                  AND COALESCE(preview_seconds, -1) = COALESCE(?, -1)
                """,
                (song_id, mode, engine, dictionary, batch_seconds, preview_seconds),
            )

    def latest_completed_job(self, song_id: str) -> AnalysisJob | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM analysis_jobs
                WHERE song_id = ? AND status = 'completed'
                ORDER BY
                    CASE mode WHEN 'full_song' THEN 0 WHEN 'practice' THEN 1 WHEN 'batched' THEN 2 ELSE 3 END,
                    created_at DESC
                LIMIT 1
                """,
                (song_id,),
            ).fetchone()
            return self._job_from_row(row) if row else None

    def save_batch(self, batch: AnalysisBatch) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO analysis_batches(
                    job_id, batch_index, start, end, status, progress, engine,
                    error, started_at, completed_at, elapsed_seconds, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(job_id, batch_index) DO UPDATE SET
                    start = excluded.start,
                    end = excluded.end,
                    status = excluded.status,
                    progress = excluded.progress,
                    engine = excluded.engine,
                    error = excluded.error,
                    started_at = COALESCE(excluded.started_at, analysis_batches.started_at),
                    completed_at = COALESCE(excluded.completed_at, analysis_batches.completed_at),
                    elapsed_seconds = COALESCE(excluded.elapsed_seconds, analysis_batches.elapsed_seconds),
                    updated_at = excluded.updated_at
                """,
                (
                    batch.job_id,
                    batch.batch_index,
                    batch.start,
                    batch.end,
                    batch.status,
                    batch.progress,
                    batch.engine,
                    batch.error,
                    batch.started_at,
                    batch.completed_at,
                    batch.elapsed_seconds,
                    batch.created_at,
                    batch.updated_at,
                ),
            )

    def save_segments(self, job_id: str, batch_index: int, segments: list[ChordSegment]) -> None:
        with self.database.connect() as connection:
            connection.execute(
                "DELETE FROM chord_segments WHERE job_id = ? AND batch_index = ?",
                (job_id, batch_index),
            )
            for segment_index, segment in enumerate(segments):
                connection.execute(
                    """
                    INSERT INTO chord_segments(
                        job_id, batch_index, segment_index, start, end, label, root,
                        quality, bass, notes_json, intervals_json, confidence,
                        corrected, source
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        batch_index,
                        segment_index,
                        segment.start,
                        segment.end,
                        segment.label,
                        segment.root,
                        segment.quality,
                        segment.bass,
                        json.dumps(segment.notes),
                        json.dumps(segment.intervals),
                        segment.confidence,
                        1 if segment.corrected else 0,
                        segment.source,
                    ),
                )

    def list_batches(self, job_id: str, include_segments: bool = True) -> list[AnalysisBatch]:
        with self.database.connect() as connection:
            batch_rows = connection.execute(
                "SELECT * FROM analysis_batches WHERE job_id = ? ORDER BY batch_index",
                (job_id,),
            ).fetchall()
            segments_by_batch: dict[int, list[ChordSegment]] = {}
            if include_segments:
                segment_rows = connection.execute(
                    "SELECT * FROM chord_segments WHERE job_id = ? ORDER BY start, end",
                    (job_id,),
                ).fetchall()
                for row in segment_rows:
                    segments_by_batch.setdefault(row["batch_index"], []).append(self._segment_from_row(row))

            return [
                self._batch_from_row(row, segments_by_batch.get(row["batch_index"], []))
                for row in batch_rows
            ]

    def list_segments(self, job_id: str) -> list[ChordSegment]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM chord_segments WHERE job_id = ? ORDER BY start, end",
                (job_id,),
            ).fetchall()
            return [self._segment_from_row(row) for row in rows]

    def completed_batch_indexes(self, job_id: str) -> set[int]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT batch_index FROM analysis_batches WHERE job_id = ? AND status = 'completed'",
                (job_id,),
            ).fetchall()
            return {row["batch_index"] for row in rows}

    def replace_corrections(self, song_id: str, corrections: list[Correction]) -> list[Correction]:
        now = utc_now_iso()
        with self.database.connect() as connection:
            connection.execute("DELETE FROM chord_corrections WHERE song_id = ?", (song_id,))
            for index, correction in enumerate(corrections):
                connection.execute(
                    """
                    INSERT INTO chord_corrections(song_id, correction_index, start, end, label, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (song_id, index, correction.start, correction.end, normalize_chord_label(correction.label), now),
                )
        return [
            Correction(start=correction.start, end=correction.end, label=normalize_chord_label(correction.label))
            for correction in corrections
        ]

    def list_corrections(self, song_id: str) -> list[Correction]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM chord_corrections WHERE song_id = ? ORDER BY start, end",
                (song_id,),
            ).fetchall()
            return [
                Correction(start=row["start"], end=row["end"], label=normalize_chord_label(row["label"]))
                for row in rows
            ]

    def save_lyrics(
        self,
        song_id: str,
        lyrics_text: str,
        *,
        synced: bool,
        source: str,
        provider: str | None = None,
    ) -> Lyrics:
        now = utc_now_iso()
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO song_lyrics(song_id, lyrics_text, synced, source, provider, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(song_id) DO UPDATE SET
                    lyrics_text = excluded.lyrics_text,
                    synced = excluded.synced,
                    source = excluded.source,
                    provider = excluded.provider,
                    updated_at = excluded.updated_at
                """,
                (song_id, lyrics_text, 1 if synced else 0, source, provider, now, now),
            )
            row = connection.execute("SELECT * FROM song_lyrics WHERE song_id = ?", (song_id,)).fetchone()
            return self._lyrics_from_row(row)

    def get_lyrics(self, song_id: str) -> Lyrics | None:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM song_lyrics WHERE song_id = ?", (song_id,)).fetchone()
            return self._lyrics_from_row(row) if row else None

    def _song_from_row(self, row) -> Song:
        return Song(
            id=row["id"],
            path=row["path"],
            title=row["title"],
            content_hash=row["content_hash"],
            duration=row["duration"],
            created_at=row["created_at"],
        )

    def _job_from_row(self, row) -> AnalysisJob:
        return AnalysisJob(
            id=row["id"],
            song_id=row["song_id"],
            mode=row["mode"],
            status=row["status"],
            progress=row["progress"],
            engine=row["engine"],
            dictionary=row["dictionary"],
            key_label=row["key_label"],
            tempo_bpm=row["tempo_bpm"],
            batch_seconds=row["batch_seconds"],
            preview_seconds=row["preview_seconds"],
            force=bool(row["force"]),
            error=row["error"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def _batch_from_row(self, row, segments: list[ChordSegment]) -> AnalysisBatch:
        return AnalysisBatch(
            job_id=row["job_id"],
            batch_index=row["batch_index"],
            start=row["start"],
            end=row["end"],
            status=row["status"],
            progress=row["progress"],
            engine=row["engine"],
            error=row["error"],
            started_at=row["started_at"],
            completed_at=row["completed_at"],
            elapsed_seconds=row["elapsed_seconds"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            segments=segments,
        )

    def _segment_from_row(self, row) -> ChordSegment:
        return ChordSegment(
            start=row["start"],
            end=row["end"],
            label=normalize_chord_label(row["label"]),
            root=row["root"],
            quality=row["quality"],
            notes=json.loads(row["notes_json"] or "[]"),
            intervals=json.loads(row["intervals_json"] or "[]"),
            bass=row["bass"],
            confidence=row["confidence"],
            corrected=bool(row["corrected"]),
            source=row["source"],
        )

    def _lyrics_from_row(self, row) -> Lyrics:
        return Lyrics(
            song_id=row["song_id"],
            lyrics_text=row["lyrics_text"],
            synced=bool(row["synced"]),
            source=row["source"],
            provider=row["provider"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
