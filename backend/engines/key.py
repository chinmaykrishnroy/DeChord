from __future__ import annotations

from typing import Protocol
import importlib.util


class KeyEngine(Protocol):
    engine_id: str

    def estimate(self, audio_path: str) -> str | None: ...


class MadmomKeyEngine:
    engine_id = "madmom-key"

    def __init__(self):
        self.processor = None
        self.engine_id = (
            "madmom-key"
            if importlib.util.find_spec("madmom")
            else "librosa-key-profile"
        )

    def estimate(self, audio_path: str) -> str | None:
        if self.engine_id == "librosa-key-profile":
            try:
                from backend.engines.signal_features import global_features

                return global_features(audio_path)[0]
            except Exception:
                return None
        try:
            import madmom
            from legacy_desktop.audio_runtime import ensure_ffmpeg_available
        except Exception:
            return None
        try:
            ensure_ffmpeg_available()
            if self.processor is None:
                self.processor = madmom.features.key.CNNKeyRecognitionProcessor()
            key_prediction = self.processor(audio_path)
            return madmom.features.key.key_prediction_to_label(key_prediction)
        except Exception:
            return None
