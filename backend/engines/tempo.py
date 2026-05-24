from __future__ import annotations

from typing import Protocol


class TempoEngine(Protocol):
    engine_id: str

    def estimate(self, audio_path: str) -> float | None:
        ...


class MadmomTempoEngine:
    engine_id = "madmom-tempo"

    def estimate(self, audio_path: str) -> float | None:
        try:
            from audio_runtime import ensure_ffmpeg_available
            from madmom.features.beats import RNNBeatProcessor
            from madmom.features.tempo import TempoEstimationProcessor
        except Exception:
            return None
        try:
            ensure_ffmpeg_available()
            beats = RNNBeatProcessor()(audio_path)
            tempos = TempoEstimationProcessor(fps=200)(beats)
            if not len(tempos):
                return None
            tempo = float(tempos[0][0])
            while tempo < 70:
                tempo *= 2
            while tempo > 190:
                tempo /= 2
            return round(tempo, 2)
        except Exception:
            return None
