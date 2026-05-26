from __future__ import annotations

from typing import Protocol


class KeyEngine(Protocol):
    engine_id: str

    def estimate(self, audio_path: str) -> str | None:
        ...


class MadmomKeyEngine:
    engine_id = "madmom-key"

    def estimate(self, audio_path: str) -> str | None:
        try:
            import madmom
            from legacy_desktop.audio_runtime import ensure_ffmpeg_available
        except Exception:
            return None
        try:
            ensure_ffmpeg_available()
            key_processor = madmom.features.key.CNNKeyRecognitionProcessor()
            key_prediction = key_processor(audio_path)
            return madmom.features.key.key_prediction_to_label(key_prediction)
        except Exception:
            return None
