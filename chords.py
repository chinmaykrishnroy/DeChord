from PyQt5.QtCore import QThread, pyqtSignal
import madmom
from analysis_cache import cache_file_for_audio
from chord_types import normalize_chord_label

class ChordRecognitionThread(QThread):
    result = pyqtSignal(list)
    error = pyqtSignal(str)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path

    def run(self):
        try:
            cache_file = cache_file_for_audio(self.audio_path, "cache/chord/", engine_id="madmom-chords-v1")
            cached_chords = self._load_cache(cache_file)
            if cached_chords is not None:
                self.result.emit(cached_chords)
                return

            feat_processor = madmom.features.chords.CNNChordFeatureProcessor()
            recog_processor = madmom.features.chords.CRFChordRecognitionProcessor()
            feats = feat_processor(self.audio_path)
            chords = recog_processor(feats)
            formatted_chords = []
            with open(cache_file, "w", encoding="utf-8") as f:
                for chord in chords:
                    start_time, end_time, chord_label = chord
                    display_label = normalize_chord_label(chord_label)
                    formatted_chords.append((start_time, end_time, display_label))
                    f.write(f"{start_time},{end_time},{display_label}\n")
            self.result.emit(formatted_chords)
        except Exception as e:
            self.error.emit(f"Chord analysis failed: {e}")
        finally:
            self.quit()

    def _load_cache(self, cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_chords = []
                for line in f:
                    if not line.strip():
                        continue
                    start, end, label = line.rstrip("\n").split(",", 2)
                    cached_chords.append((float(start), float(end), label))
            return cached_chords
        except FileNotFoundError:
            return None
        except (OSError, ValueError):
            return None
