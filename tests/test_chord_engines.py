import types
import unittest
from unittest.mock import patch

from chord_engines import ChordEngineUnavailable, LvChordiaChordEngine, get_chord_engine


class ChordEngineSelectionTest(unittest.TestCase):
    def test_lv_chordia_is_primary_engine(self):
        engine = get_chord_engine("lv-chordia")
        self.assertEqual(engine.name, "lv-chordia")

    def test_primary_falls_back_to_madmom_when_lv_chordia_is_missing(self):
        with patch("importlib.util.find_spec", return_value=None):
            engine = get_chord_engine("lv-chordia")
            with patch("chord_engines.MadmomChordEngine.recognize", return_value=[(0.0, 1.0, "C")]):
                self.assertEqual(engine.recognize("song.mp3"), [(0.0, 1.0, "C")])
                self.assertEqual(engine.last_engine_name, "madmom")

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
                    (0.0, 1.0, "Cmaj7"),
                    (1.0, 2.0, "Asus4"),
                    (2.0, 3.0, "N"),
                ],
            )

    def test_primary_falls_back_to_madmom_when_lv_chordia_runtime_fails(self):
        with patch("importlib.util.find_spec", return_value=True), patch.object(
            LvChordiaChordEngine, "recognize", side_effect=RuntimeError("torch failed")
        ), patch("chord_engines.MadmomChordEngine.recognize", return_value=[(0.0, 1.0, "C")]):
            engine = get_chord_engine("lv-chordia")
            self.assertEqual(engine.recognize("song.mp3"), [(0.0, 1.0, "C")])
            self.assertEqual(engine.last_engine_name, "madmom")


if __name__ == "__main__":
    unittest.main()
