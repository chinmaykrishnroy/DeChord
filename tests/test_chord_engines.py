import types
import unittest
from unittest.mock import patch

from legacy_desktop.chord_engines import ChordEngineUnavailable, LvChordiaChordEngine, get_chord_engine


class ChordEngineSelectionTest(unittest.TestCase):
    def test_lv_chordia_is_primary_engine(self):
        engine = get_chord_engine("lv-chordia")
        self.assertEqual(engine.name, "lv-chordia")

    def test_primary_falls_back_to_madmom_when_lv_chordia_is_missing(self):
        with patch("importlib.util.find_spec", return_value=None):
            engine = get_chord_engine("lv-chordia")
            with patch("legacy_desktop.chord_engines.MadmomChordEngine.recognize", return_value=[(0.0, 1.0, "C")]):
                self.assertEqual(engine.recognize("song.mp3"), [(0.0, 1.0, "C")])
                self.assertEqual(engine.last_engine_name, "madmom")
                self.assertEqual(engine.active_cache_id(), "madmom-chords-v1")

    def test_primary_cache_prefers_native_engine_when_available(self):
        with patch("importlib.util.find_spec", return_value=True):
            engine = get_chord_engine("lv-chordia", "submission")
            self.assertEqual(engine.preferred_cache_id(), "lv-chordia-submission-v1")
            self.assertEqual(engine.engine_name_for_cache_id(engine.preferred_cache_id()), "lv-chordia")

    def test_primary_cache_uses_fallback_scope_when_native_engine_is_missing(self):
        with patch("importlib.util.find_spec", return_value=None):
            engine = get_chord_engine("lv-chordia", "submission")
            self.assertEqual(engine.preferred_cache_id(), "madmom-chords-v1")
            self.assertEqual(engine.engine_name_for_cache_id(engine.preferred_cache_id()), "madmom")

    def test_direct_lv_chordia_raises_when_missing(self):
        with patch("importlib.util.find_spec", return_value=None):
            with self.assertRaises(ChordEngineUnavailable):
                get_chord_engine("lv-chordia-direct")

    def test_lv_chordia_segments_are_normalized(self):
        completed = types.SimpleNamespace(
            returncode=0,
            stdout='[[0.0, 1.0, "C:maj7"], [1.0, 2.0, "A:sus"], [2.0, 3.0, "N"]]',
            stderr="",
        )

        with patch("importlib.util.find_spec", return_value=True), patch("subprocess.run", return_value=completed):
            engine = LvChordiaChordEngine()
            self.assertEqual(
                engine.recognize("song.mp3"),
                [
                    (0.0, 1.0, "CM7"),
                    (1.0, 2.0, "Asus4"),
                    (2.0, 3.0, "N"),
                ],
            )

    def test_primary_falls_back_to_madmom_when_lv_chordia_runtime_fails(self):
        with patch("importlib.util.find_spec", return_value=True), patch.object(
            LvChordiaChordEngine, "recognize", side_effect=RuntimeError("torch failed")
        ), patch("legacy_desktop.chord_engines.MadmomChordEngine.recognize", return_value=[(0.0, 1.0, "C")]):
            engine = get_chord_engine("lv-chordia")
            self.assertEqual(engine.recognize("song.mp3"), [(0.0, 1.0, "C")])
            self.assertEqual(engine.last_engine_name, "madmom")
            self.assertEqual(engine.active_cache_id(), "madmom-chords-v1")


if __name__ == "__main__":
    unittest.main()
