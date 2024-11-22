import os
import hashlib
from PyQt5.QtCore import QThread, pyqtSignal
import madmom

class ChordRecognitionThread(QThread):
    result = pyqtSignal(list)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path

    def run(self):
        cache_dir = "cache/chord/"
        os.makedirs(cache_dir, exist_ok=True)
        hash_object = hashlib.md5(self.audio_path.encode())
        hashed_filename = hash_object.hexdigest() + ".txt"
        cache_file = os.path.join(cache_dir, hashed_filename)
        if os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                cached_chords = [
                    (float(start), float(end), label)
                    for line in f
                    for start, end, label in [line.strip().split(",")]
                ]
            self.result.emit(cached_chords)
            self.quit()
            return

        feat_processor = madmom.features.chords.CNNChordFeatureProcessor()
        recog_processor = madmom.features.chords.CRFChordRecognitionProcessor()
        feats = feat_processor(self.audio_path)
        chords = recog_processor(feats)
        formatted_chords = []
        with open(cache_file, "w") as f:
            for chord in chords:
                start_time, end_time, chord_label = chord
                if ":maj" in chord_label:
                    chord_label = chord_label.replace(":maj", "")
                elif ":min" in chord_label:
                    chord_label = chord_label.replace(":min", "m")
                formatted_chords.append((start_time, end_time, chord_label))
                f.write(f"{start_time},{end_time},{chord_label}\n")
        self.result.emit(formatted_chords)
        self.quit()
