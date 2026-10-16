from __future__ import annotations

from typing import Protocol
import importlib.util


class TempoEngine(Protocol):
    engine_id: str

    def estimate(self, audio_path: str) -> float | None: ...


class MadmomTempoEngine:
    engine_id = "madmom-tempo"

    def __init__(self):
        self.beats = None
        self.tempo = None
        self.engine_id = (
            "madmom-tempo"
            if importlib.util.find_spec("madmom")
            else "librosa-onset-tempo"
        )

    def estimate(self, audio_path: str) -> float | None:
        if self.engine_id == "librosa-onset-tempo":
            try:
                from backend.engines.signal_features import global_features

                return global_features(audio_path)[1]
            except Exception:
                return None
        try:
            from legacy_desktop.audio_runtime import ensure_ffmpeg_available
            from madmom.features.beats import RNNBeatProcessor
            from madmom.features.tempo import TempoEstimationProcessor
        except Exception:
            return None
        try:
            ensure_ffmpeg_available()
            if self.beats is None:
                self.beats = RNNBeatProcessor()
                # RNNBeatProcessor's default output is 100 frames per second.
                self.tempo = TempoEstimationProcessor(fps=100)
            beats = self.beats(audio_path)
            tempos = self.tempo(beats)
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
