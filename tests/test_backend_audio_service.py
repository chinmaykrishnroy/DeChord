from __future__ import annotations

import tempfile
import unittest
from io import BytesIO
from pathlib import Path

from backend.core.config import BackendConfig
from backend.core.database import AnalysisDatabase
from backend.core.time import utc_now_iso
from backend.domain.models import AnalysisBatch, Correction
from backend.engines.chord import build_chord_segment
from backend.repositories.analysis_repository import AnalysisRepository
from backend.services.analysis_service import AnalysisService


class FakeMediaTools:
    def __init__(self, duration: float = 95.0) -> None:
        self.duration = duration

    def probe_duration(self, audio_path: str | Path) -> float:
        return self.duration


class FakeChordEngine:
    engine_id = "fake-chords"

    def __init__(self) -> None:
        self.calls: list[tuple[str, float, float | None]] = []

    def recognize(self, audio_path: str, start: float = 0.0, duration: float | None = None):
        self.calls.append((audio_path, start, duration))
        end = start + (duration if duration is not None else 12.0)
        mid = start + min(4.0, max(1.0, (end - start) / 2))
        return [
            build_chord_segment(start, mid, "C:maj7", source=self.engine_id),
            build_chord_segment(mid, end, "G:7", source=self.engine_id),
        ]


class LeadingNoChordEngine:
    engine_id = "fake-boundary-chords"

    def recognize(self, audio_path: str, start: float = 0.0, duration: float | None = None):
        end = start + (duration if duration is not None else 12.0)
        return [
            build_chord_segment(start, start + 0.2, "N", source=self.engine_id),
            build_chord_segment(start + 0.2, end, "D:maj", source=self.engine_id),
        ]


class FakeKeyEngine:
    engine_id = "fake-key"

    def estimate(self, audio_path: str) -> str:
        return "C major"


class FakeTempoEngine:
    engine_id = "fake-tempo"

    def estimate(self, audio_path: str) -> float:
        return 120.0


class BackendAudioServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.audio = self.root / "song.mp3"
        self.audio.write_bytes(b"not-real-audio-but-hashable")
        self.config = BackendConfig(
            database_path=self.root / "backend.sqlite3",
            work_dir=self.root / "work",
            default_engine="fake-chords",
            default_dictionary="test",
        )
        self.chord_engine = FakeChordEngine()
        self.service = AnalysisService(
            config=self.config,
            repository=AnalysisRepository(AnalysisDatabase(config=self.config)),
            chord_engine=self.chord_engine,
            key_engine=FakeKeyEngine(),
            tempo_engine=FakeTempoEngine(),
            media_tools=FakeMediaTools(duration=95.0),
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_import_song_uses_content_hash_identity(self) -> None:
        first = self.service.import_song(str(self.audio))
        second = self.service.import_song(str(self.audio))

        self.assertEqual(first.id, second.id)
        self.assertEqual(first.content_hash, second.content_hash)
        self.assertEqual(first.duration, 95.0)

    def test_uploaded_song_keeps_original_display_title(self) -> None:
        song = self.service.import_uploaded_song("Nice Song.mp3", BytesIO(b"uploaded-audio"))

        self.assertEqual(song.title, "Nice Song")
        self.assertTrue(Path(song.path).name.endswith("-Nice-Song.mp3"))

    def test_uploaded_media_is_removed_after_successful_analysis(self) -> None:
        song = self.service.import_uploaded_song("Temp Song.mp3", BytesIO(b"uploaded-audio"))
        uploaded_path = Path(song.path)

        self.assertTrue(uploaded_path.exists())
        self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30)

        self.assertFalse(uploaded_path.exists())

    def test_cached_analysis_reuse_removes_new_uploaded_copy(self) -> None:
        first = self.service.import_uploaded_song("Cached Song.mp3", BytesIO(b"same-audio"))
        self.service.create_analysis_job(first.id, mode="preview", preview_seconds=30)
        second = self.service.import_uploaded_song("Cached Song.mp3", BytesIO(b"same-audio"))
        second_path = Path(second.path)

        cached = self.service.create_analysis_job(second.id, mode="preview", preview_seconds=30)

        self.assertEqual(cached.status, "completed")
        self.assertFalse(second_path.exists())

    def test_preview_analyzes_only_preview_window(self) -> None:
        song = self.service.import_song(str(self.audio))
        job = self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30)
        batches = self.service.get_batches(job.id)

        self.assertEqual(job.status, "completed")
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0].start, 0.0)
        self.assertEqual(batches[0].end, 30.0)
        self.assertEqual(self.chord_engine.calls[-1][1:], (0.0, 30.0))

    def test_batched_mode_stores_absolute_batch_times(self) -> None:
        song = self.service.import_song(str(self.audio))
        job = self.service.create_analysis_job(song.id, mode="batched", batch_seconds=30)
        batches = self.service.get_batches(job.id)
        timeline = self.service.get_timeline(song.id)

        self.assertEqual(len(batches), 4)
        self.assertEqual([(batch.start, batch.end) for batch in batches], [(0.0, 30.0), (30.0, 60.0), (60.0, 90.0), (90.0, 95.0)])
        self.assertTrue(all(batch.elapsed_seconds is not None for batch in batches))
        self.assertEqual(self.chord_engine.calls[0][1:], (0.0, 32.0))
        self.assertEqual(self.chord_engine.calls[1][1:], (28.0, 34.0))
        self.assertEqual(timeline.segments[0].start, 0.0)
        self.assertEqual(timeline.segments[-1].end, 95.0)

    def test_large_batch_size_falls_back_to_full_song(self) -> None:
        song = self.service.import_song(str(self.audio))
        job = self.service.create_analysis_job(song.id, mode="batched", batch_seconds=120)

        self.assertEqual(job.mode, "full_song")
        self.assertIsNone(job.batch_seconds)
        self.assertEqual(self.chord_engine.calls[-1][1:], (0.0, None))

    def test_short_leading_no_chord_is_suppressed_for_windowed_analysis(self) -> None:
        service = AnalysisService(
            config=self.config,
            repository=AnalysisRepository(AnalysisDatabase(config=self.config)),
            chord_engine=LeadingNoChordEngine(),
            key_engine=FakeKeyEngine(),
            tempo_engine=FakeTempoEngine(),
            media_tools=FakeMediaTools(duration=95.0),
        )
        song = service.import_song(str(self.audio))
        job = service.create_analysis_job(song.id, mode="preview", preview_seconds=30)
        segments = service.repository.list_segments(job.id)

        self.assertEqual(segments[0].label, "D")
        self.assertEqual(segments[0].start, 0.0)

    def test_resumable_batched_job_appends_missing_batches(self) -> None:
        song = self.service.import_song(str(self.audio))
        job = self.service.create_analysis_job(song.id, mode="batched", batch_seconds=30, run_immediately=False)
        now = utc_now_iso()
        self.service.repository.save_batch(
            AnalysisBatch(
                job_id=job.id,
                batch_index=0,
                start=0.0,
                end=30.0,
                status="completed",
                progress=1.0,
                engine=job.engine,
                error=None,
                started_at=now,
                completed_at=now,
                elapsed_seconds=1.25,
                created_at=now,
                updated_at=now,
            )
        )
        self.service.repository.save_segments(job.id, 0, [build_chord_segment(0, 30, "C:maj")])
        self.service.repository.update_job(job.id, status="failed", progress=0.25, error="stopped")

        resumed = self.service.create_analysis_job(song.id, mode="batched", batch_seconds=30)
        batches = self.service.get_batches(resumed.id)

        self.assertEqual(resumed.id, job.id)
        self.assertEqual(resumed.status, "completed")
        self.assertEqual(len(batches), 4)
        self.assertEqual(batches[0].elapsed_seconds, 1.25)
        self.assertEqual(len(self.chord_engine.calls), 3)

    def test_job_timeline_can_target_a_specific_analysis(self) -> None:
        song = self.service.import_song(str(self.audio))
        full_job = self.service.create_analysis_job(song.id, mode="full_song")
        batched_job = self.service.create_analysis_job(song.id, mode="batched", batch_seconds=30)

        full_timeline = self.service.get_job_timeline(full_job.id)
        batched_timeline = self.service.get_job_timeline(batched_job.id)

        self.assertEqual(full_timeline.job.id, full_job.id)
        self.assertEqual(batched_timeline.job.id, batched_job.id)
        self.assertEqual(len(full_timeline.segments), 2)
        self.assertEqual(len(batched_timeline.segments), 8)

    def test_completed_job_is_reused_when_not_forced(self) -> None:
        song = self.service.import_song(str(self.audio))
        first = self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30)
        second = self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30)

        self.assertEqual(first.id, second.id)
        self.assertEqual(len(self.chord_engine.calls), 1)

    def test_force_recompute_replaces_compatible_job(self) -> None:
        song = self.service.import_song(str(self.audio))
        first = self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30)
        second = self.service.create_analysis_job(song.id, mode="preview", preview_seconds=30, force=True)

        self.assertNotEqual(first.id, second.id)
        self.assertIsNone(self.service.get_job(first.id))

    def test_corrections_override_timeline_segments(self) -> None:
        song = self.service.import_song(str(self.audio))
        self.service.create_analysis_job(song.id, mode="full_song")
        timeline = self.service.save_corrections(song.id, [Correction(start=2.0, end=6.0, label="F#:dim7")])

        corrected = [segment for segment in timeline.segments if segment.corrected]
        self.assertEqual(len(corrected), 1)
        self.assertEqual(corrected[0].label, "F#dim7")
        self.assertEqual(corrected[0].notes, ["F#", "A", "C", "D#"])

    def test_export_uses_corrected_timeline(self) -> None:
        song = self.service.import_song(str(self.audio))
        self.service.create_analysis_job(song.id, mode="full_song")
        self.service.save_corrections(song.id, [Correction(start=2.0, end=6.0, label="D:min7")])
        rows = self.service.export_chords(song.id)

        self.assertTrue(any(row["chord"] == "Dm7" and row["source"] == "correction" for row in rows))

    def test_invalid_correction_range_is_rejected(self) -> None:
        song = self.service.import_song(str(self.audio))
        self.service.create_analysis_job(song.id, mode="full_song")

        with self.assertRaises(ValueError):
            self.service.save_corrections(song.id, [Correction(start=8.0, end=4.0, label="C")])


if __name__ == "__main__":
    unittest.main()
