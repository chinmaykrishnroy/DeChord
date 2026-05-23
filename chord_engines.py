import importlib.util
import json
import os
import subprocess
import sys

from chord_types import normalize_chord_label


DEFAULT_CHORD_ENGINE = "lv-chordia"
DEFAULT_LV_CHORDIA_DICT = "submission"


class ChordEngineUnavailable(Exception):
    pass


class ChordEngine:
    name = "base"
    cache_id = "base"

    def recognize(self, audio_path):
        raise NotImplementedError


class MadmomChordEngine(ChordEngine):
    name = "madmom"
    cache_id = "madmom-chords-v1"

    def recognize(self, audio_path):
        import madmom

        feat_processor = madmom.features.chords.CNNChordFeatureProcessor()
        recog_processor = madmom.features.chords.CRFChordRecognitionProcessor()
        feats = feat_processor(audio_path)
        chords = recog_processor(feats)
        return [
            (float(start_time), float(end_time), normalize_chord_label(chord_label))
            for start_time, end_time, chord_label in chords
        ]


class LvChordiaChordEngine(ChordEngine):
    name = "lv-chordia"

    def __init__(self, chord_dict_name=DEFAULT_LV_CHORDIA_DICT):
        if importlib.util.find_spec("lv_chordia") is None:
            raise ChordEngineUnavailable("lv-chordia is not installed.")
        self.chord_dict_name = chord_dict_name
        self.cache_id = f"lv-chordia-{chord_dict_name}-v1"

    def recognize(self, audio_path):
        worker_path = os.path.join(os.path.dirname(__file__), "advanced_chord_worker.py")
        completed = subprocess.run(
            [sys.executable, "-B", worker_path, audio_path, self.chord_dict_name],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            error = completed.stderr.strip() or completed.stdout.strip()
            raise RuntimeError(f"lv-chordia failed: {error}")

        results = json.loads(completed.stdout)
        return [
            (float(start_time), float(end_time), normalize_chord_label(chord_label))
            for start_time, end_time, chord_label in results
        ]


class PrimaryChordEngine(ChordEngine):
    name = "lv-chordia"

    def __init__(self, chord_dict_name=DEFAULT_LV_CHORDIA_DICT):
        self.chord_dict_name = chord_dict_name
        self.cache_id = f"lv-chordia-primary-{chord_dict_name}-fallback-madmom-v1"
        self.last_engine_name = None

    def recognize(self, audio_path):
        if importlib.util.find_spec("lv_chordia") is not None:
            try:
                self.last_engine_name = "lv-chordia"
                return LvChordiaChordEngine(self.chord_dict_name).recognize(audio_path)
            except Exception:
                self.last_engine_name = "madmom"
                return MadmomChordEngine().recognize(audio_path)

        self.last_engine_name = "madmom"
        return MadmomChordEngine().recognize(audio_path)


class DirectLvChordiaChordEngine(ChordEngine):
    name = "lv-chordia-direct"

    def __init__(self, chord_dict_name=DEFAULT_LV_CHORDIA_DICT):
        if importlib.util.find_spec("lv_chordia") is None:
            raise ChordEngineUnavailable("lv-chordia is not installed.")
        self.chord_dict_name = chord_dict_name
        self.cache_id = f"lv-chordia-direct-{chord_dict_name}-v1"

    def recognize(self, audio_path):
        from audio_runtime import ensure_ffmpeg_available
        from lv_chordia.chord_recognition import chord_recognition

        ensure_ffmpeg_available()
        results = chord_recognition(audio_path, chord_dict_name=self.chord_dict_name)
        return [
            (
                float(segment["start_time"]),
                float(segment["end_time"]),
                normalize_chord_label(segment["chord"]),
            )
            for segment in results
        ]


def get_chord_engine(engine_name=DEFAULT_CHORD_ENGINE, chord_dict_name=DEFAULT_LV_CHORDIA_DICT):
    if engine_name in {"primary", "native"}:
        engine_name = "lv-chordia"

    if engine_name == "auto":
        return PrimaryChordEngine(chord_dict_name=chord_dict_name)

    if engine_name == "lv-chordia":
        return PrimaryChordEngine(chord_dict_name=chord_dict_name)

    if engine_name == "lv-chordia-direct":
        return DirectLvChordiaChordEngine(chord_dict_name=chord_dict_name)

    if engine_name == "madmom":
        return MadmomChordEngine()

    raise ValueError(f"Unknown chord engine: {engine_name}")
