from __future__ import annotations

from pathlib import Path
from typing import Protocol

from chord_types import parse_chord_label

from backend.core.config import BackendConfig
from backend.core.media import MediaTools
from backend.domain.models import ChordSegment


class ChordEngine(Protocol):
    engine_id: str

    def recognize(self, audio_path: str, start: float = 0.0, duration: float | None = None) -> list[ChordSegment]:
        ...


class LvChordiaEngine:
    """Adapter around the current lv-chordia integration.

    Batch windows are extracted to temporary WAV files and returned using absolute
    song time. That keeps frontend parsing simple and makes streamed batches
    appendable without a second time conversion step.
    """

    def __init__(self, config: BackendConfig | None = None, media_tools: MediaTools | None = None) -> None:
        self.config = config or BackendConfig()
        self.media_tools = media_tools or MediaTools(self.config.work_dir)
        self.engine_id = self.config.default_engine

    def recognize(self, audio_path: str, start: float = 0.0, duration: float | None = None) -> list[ChordSegment]:
        from chord_engines import get_chord_engine

        path_to_analyze = Path(audio_path)
        offset = 0.0
        clip_end = None
        piece_path: Path | None = None

        if start > 0 or duration is not None:
            piece_duration = duration if duration is not None else self.media_tools.probe_duration(audio_path)
            if piece_duration is None:
                raise RuntimeError("A duration is required for piece analysis.")
            piece_path = self.media_tools.extract_piece(audio_path, start, piece_duration)
            path_to_analyze = piece_path
            offset = start
            clip_end = start + piece_duration

        try:
            engine = get_chord_engine(self.engine_id, chord_dict_name=self.config.default_dictionary)
            raw_segments = engine.recognize(str(path_to_analyze))
            return self._to_segments(raw_segments, offset=offset, clip_end=clip_end)
        finally:
            if piece_path is not None:
                piece_path.unlink(missing_ok=True)

    def _to_segments(
        self,
        raw_segments: list[tuple[float, float, str]],
        offset: float,
        clip_end: float | None,
    ) -> list[ChordSegment]:
        segments: list[ChordSegment] = []
        for start, end, label in raw_segments:
            absolute_start = max(0.0, float(start) + offset)
            absolute_end = max(absolute_start, float(end) + offset)
            if clip_end is not None:
                absolute_end = min(absolute_end, clip_end)
            if absolute_end <= absolute_start:
                continue
            segments.append(build_chord_segment(absolute_start, absolute_end, label, source=self.engine_id))
        return segments


def build_chord_segment(
    start: float,
    end: float,
    label: str,
    confidence: float | None = None,
    corrected: bool = False,
    source: str = "engine",
) -> ChordSegment:
    parsed = parse_chord_label(label)
    return ChordSegment(
        start=round(float(start), 3),
        end=round(float(end), 3),
        label=parsed.display,
        root=parsed.root,
        quality=parsed.quality_name,
        notes=parsed.notes,
        intervals=parsed.intervals,
        bass=parsed.bass,
        confidence=confidence,
        corrected=corrected,
        source=source,
    )
