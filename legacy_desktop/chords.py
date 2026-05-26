from PyQt5.QtCore import QThread, pyqtSignal
from analysis_cache import cache_file_for_audio
from chord_engines import DEFAULT_CHORD_ENGINE, DEFAULT_LV_CHORDIA_DICT, get_chord_engine
from chord_types import normalize_chord_label

class ChordRecognitionThread(QThread):
    result = pyqtSignal(list)
    engine_ready = pyqtSignal(str)
    error = pyqtSignal(str)

    def __init__(self, audio_path, engine_name=DEFAULT_CHORD_ENGINE, chord_dict_name=DEFAULT_LV_CHORDIA_DICT):
        super().__init__()
        self.audio_path = audio_path
        self.engine_name = engine_name
        self.chord_dict_name = chord_dict_name

    def run(self):
        try:
            engine = get_chord_engine(self.engine_name, self.chord_dict_name)
            self.engine_ready.emit(engine.name)
            cache_engine_id = engine.preferred_cache_id()
            cache_file = cache_file_for_audio(self.audio_path, "cache/chord/", engine_id=cache_engine_id)
            cached_chords = self._load_cache(cache_file)
            if cached_chords is not None:
                self.engine_ready.emit(engine.engine_name_for_cache_id(cache_engine_id))
                self.result.emit(cached_chords)
                return

            chords = engine.recognize(self.audio_path)
            active_engine = getattr(engine, "last_engine_name", None)
            if active_engine:
                self.engine_ready.emit(active_engine)
            write_cache_engine_id = engine.active_cache_id()
            cache_file = cache_file_for_audio(self.audio_path, "cache/chord/", engine_id=write_cache_engine_id)
            with open(cache_file, "w", encoding="utf-8") as f:
                for chord in chords:
                    start_time, end_time, chord_label = chord
                    f.write(f"{start_time},{end_time},{chord_label}\n")
            self.result.emit(chords)
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
                    cached_chords.append((float(start), float(end), normalize_chord_label(label)))
            return cached_chords
        except FileNotFoundError:
            return None
        except (OSError, ValueError):
            return None
