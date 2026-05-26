import os
import tempfile
import unittest

from legacy_desktop.analysis_cache import audio_content_hash, cache_file_for_audio
from legacy_desktop.audio_runtime import playback_audio_path


class AnalysisCacheTest(unittest.TestCase):
    def test_cache_key_changes_when_audio_content_changes_at_same_path(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            audio_path = os.path.join(tmp_dir, "song.wav")
            with open(audio_path, "wb") as audio_file:
                audio_file.write(b"first version")
            first_hash = audio_content_hash(audio_path, engine_id="test-engine")

            with open(audio_path, "wb") as audio_file:
                audio_file.write(b"second version")
            second_hash = audio_content_hash(audio_path, engine_id="test-engine")

            self.assertNotEqual(first_hash, second_hash)

    def test_cache_file_is_scoped_by_engine_id(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            audio_path = os.path.join(tmp_dir, "song.wav")
            with open(audio_path, "wb") as audio_file:
                audio_file.write(b"same content")

            first_path = cache_file_for_audio(audio_path, tmp_dir, engine_id="engine-a")
            second_path = cache_file_for_audio(audio_path, tmp_dir, engine_id="engine-b")

            self.assertNotEqual(first_path, second_path)

    def test_wav_playback_uses_original_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            audio_path = os.path.join(tmp_dir, "song.wav")
            with open(audio_path, "wb") as audio_file:
                audio_file.write(b"not a real wav, but extension is enough for routing")

            self.assertEqual(playback_audio_path(audio_path), audio_path)


if __name__ == "__main__":
    unittest.main()
