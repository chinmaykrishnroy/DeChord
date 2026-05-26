from PyQt5.QtCore import QThread, pyqtSignal
import madmom
from analysis_cache import cache_file_for_audio

class KeyRecognitionThread(QThread):
    result = pyqtSignal(str)
    error = pyqtSignal(str)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path

    def run(self):
        try:
            cache_file = cache_file_for_audio(self.audio_path, "cache/key/", engine_id="madmom-key-v1")
            cached_key = self._load_cache(cache_file)
            if cached_key is not None:
                self.result.emit(cached_key)
                return

            key_processor = madmom.features.key.CNNKeyRecognitionProcessor()
            key_prediction = key_processor(self.audio_path)
            key = madmom.features.key.key_prediction_to_label(key_prediction)
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(key)
            self.result.emit(key)
        except Exception as e:
            self.error.emit(f"Key analysis failed: {e}")
        finally:
            self.quit()

    def _load_cache(self, cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_key = f.read().strip()
            return cached_key or None
        except OSError:
            return None
