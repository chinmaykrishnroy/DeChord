from __future__ import annotations

from pathlib import Path
from typing import Protocol
import importlib.util
from importlib.metadata import version, PackageNotFoundError

from legacy_desktop.chord_types import parse_chord_label

from backend.core.config import BackendConfig
from backend.core.media import MediaTools
from backend.domain.models import ChordSegment


class ChordEngine(Protocol):
    engine_id: str

    def recognize(
        self, audio_path: str, start: float = 0.0, duration: float | None = None
    ) -> list[ChordSegment]: ...


class LvChordiaEngine:
    """Adapter around the current lv-chordia integration.

    Batch windows are extracted to temporary WAV files and returned using absolute
    song time. That keeps frontend parsing simple and makes streamed batches
    appendable without a second time conversion step.
    """

    def __init__(
        self, config: BackendConfig | None = None, media_tools: MediaTools | None = None
    ) -> None:
        self.config = config or BackendConfig()
        self.media_tools = media_tools or MediaTools(self.config.work_dir)
        self.engine_name = (
            "lv-chordia"
            if self.config.default_engine != "madmom"
            and importlib.util.find_spec("lv_chordia")
            else "madmom"
        )
        try:
            engine_version = version(self.engine_name)
        except PackageNotFoundError:
            engine_version = "unavailable"
        self.engine_id = f"{self.engine_name}:{engine_version}:preprocess-v2"
        self._session = None
        self._features = None
        self._decoder = None

    def _recognize_raw(self, path: str):
        if self.engine_name == "lv-chordia":
            import lv_chordia

            # Modern releases expose a resident session; older versions retain their one-shot API.
            session_type = getattr(lv_chordia, "LVChordiaSession", None)
            if session_type is not None:
                if self._session is None:
                    self._session = session_type(
                        chord_dict_name=self.config.default_dictionary, device="auto"
                    )
                    self._session.load()
                result = self._session.infer(path)
            else:
                from lv_chordia.chord_recognition import chord_recognition

                result = chord_recognition(
                    path, chord_dict_name=self.config.default_dictionary
                )
            return [
                (float(item["start_time"]), float(item["end_time"]), item["chord"])
                for item in result
            ]
        try:
            import madmom
        except ImportError as exc:
            raise RuntimeError(
                "No chord engine installed. Install backend/requirements-analysis.txt in the backend environment."
            ) from exc
        if self._features is None:
            self._features = madmom.features.chords.CNNChordFeatureProcessor()
            self._decoder = madmom.features.chords.CRFChordRecognitionProcessor()
        return [
            (float(start), float(end), label)
            for start, end, label in self._decoder(self._features(path))
        ]

    def close(self):
        if self._session is not None:
            self._session.release()
            self._session = None

    def recognize(
        self, audio_path: str, start: float = 0.0, duration: float | None = None
    ) -> list[ChordSegment]:
        path_to_analyze = Path(audio_path)
        offset = 0.0
        clip_end = None
        piece_path: Path | None = None

        if start > 0 or duration is not None:
            piece_duration = (
                duration
                if duration is not None
                else self.media_tools.probe_duration(audio_path)
            )
            if piece_duration is None:
                raise RuntimeError("A duration is required for piece analysis.")
            piece_path = self.media_tools.extract_piece(
                audio_path, start, piece_duration
            )
            path_to_analyze = piece_path
            offset = start
            clip_end = start + piece_duration

        try:
            self.media_tools._ensure_ffmpeg()
            raw_segments = self._recognize_raw(str(path_to_analyze))
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
            segments.append(
                build_chord_segment(
                    absolute_start, absolute_end, label, source=self.engine_id
                )
            )
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
