from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


VALID_ANALYSIS_MODES = {"full_song", "preview", "batched", "practice"}
TERMINAL_JOB_STATUSES = {"completed", "failed", "cancelled"}


@dataclass(frozen=True)
class Song:
    id: str
    path: str
    title: str
    content_hash: str
    duration: float | None
    created_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ChordSegment:
    start: float
    end: float
    label: str
    root: str | None = None
    quality: str | None = None
    notes: list[str] = field(default_factory=list)
    intervals: list[int] = field(default_factory=list)
    bass: str | None = None
    confidence: float | None = None
    corrected: bool = False
    source: str = "engine"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class AnalysisBatch:
    job_id: str
    batch_index: int
    start: float
    end: float | None
    status: str
    progress: float
    engine: str
    error: str | None
    started_at: str | None
    completed_at: str | None
    elapsed_seconds: float | None
    created_at: str
    updated_at: str
    segments: list[ChordSegment] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["segments"] = [segment.to_dict() for segment in self.segments]
        return payload


@dataclass(frozen=True)
class AnalysisJob:
    id: str
    song_id: str
    mode: str
    status: str
    progress: float
    engine: str
    dictionary: str | None
    key_label: str | None
    tempo_bpm: float | None
    batch_seconds: float | None
    preview_seconds: float | None
    force: bool
    error: str | None
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Timeline:
    song: Song
    job: AnalysisJob
    segments: list[ChordSegment]
    batches: list[AnalysisBatch]

    def to_dict(self) -> dict[str, Any]:
        return {
            "song": self.song.to_dict(),
            "job": self.job.to_dict(),
            "segments": [segment.to_dict() for segment in self.segments],
            "batches": [batch.to_dict() for batch in self.batches],
        }


@dataclass(frozen=True)
class Correction:
    start: float
    end: float
    label: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Lyrics:
    song_id: str
    lyrics_text: str
    synced: bool
    source: str
    provider: str | None
    created_at: str
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
