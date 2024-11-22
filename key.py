import os
import hashlib
from PyQt5.QtCore import QThread, pyqtSignal
import madmom

class KeyRecognitionThread(QThread):
    result = pyqtSignal(str)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path

    def run(self):
        cache_dir = "cache/key/"
        os.makedirs(cache_dir, exist_ok=True)
        hash_object = hashlib.md5(self.audio_path.encode())
        hashed_filename = hash_object.hexdigest() + ".txt"
        cache_file = os.path.join(cache_dir, hashed_filename)

        if os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                cached_key = f.read().strip()
            self.result.emit(cached_key)
            self.quit()
            return

        try:
            key_processor = madmom.features.key.CNNKeyRecognitionProcessor()
            key_prediction = key_processor(self.audio_path)
            key = madmom.features.key.key_prediction_to_label(key_prediction)
            with open(cache_file, "w") as f:
                f.write(key)
            self.result.emit(key)
        except Exception as e:
            self.result.emit("Error")
        self.quit()
