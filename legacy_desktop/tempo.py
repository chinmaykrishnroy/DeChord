from PyQt5.QtCore import QThread, pyqtSignal
from madmom.features.beats import RNNBeatProcessor
from madmom.features.tempo import TempoEstimationProcessor
from analysis_cache import cache_file_for_audio

class TempoDetectionThread(QThread):
    result = pyqtSignal(int)
    error = pyqtSignal(str)

    def __init__(self, audio_file_path):
        super().__init__()
        self.audio_file_path = audio_file_path

    def run(self):
        try:
            cache_file = cache_file_for_audio(self.audio_file_path, "cache/tempo/", engine_id="madmom-tempo-v1")
            cached_tempo = self._load_cache(cache_file)
            if cached_tempo is not None:
                self.result.emit(cached_tempo)
                return

            beat_processor = RNNBeatProcessor()
            beats = beat_processor(self.audio_file_path)
            tempo_processor = TempoEstimationProcessor(fps=200)
            tempos = tempo_processor(beats)
            if len(tempos):
                top_tempo = tempos[0][0]
                adjusted_tempo = self.adjust_tempo(top_tempo)
                rounded_tempo = round(adjusted_tempo)
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(str(rounded_tempo))
                self.result.emit(rounded_tempo)
            else:
                self.result.emit(0)
        except Exception as e:
            self.error.emit(f"Tempo analysis failed: {e}")
        finally:
            self.quit()

    def adjust_tempo(self, tempo):
        while tempo < 70:
            tempo *= 2
        while tempo > 190:
            tempo /= 2
        return tempo

    def _load_cache(self, cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return int(f.read().strip())
        except (OSError, ValueError):
            return None
