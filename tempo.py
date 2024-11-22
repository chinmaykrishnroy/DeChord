import os
import hashlib
from PyQt5.QtCore import QThread, pyqtSignal
from madmom.features.beats import RNNBeatProcessor
from madmom.features.tempo import TempoEstimationProcessor

class TempoDetectionThread(QThread):
    result = pyqtSignal(int)

    def __init__(self, audio_file_path):
        super().__init__()
        self.audio_file_path = audio_file_path

    def run(self):
        cache_dir = "cache/tempo/"
        os.makedirs(cache_dir, exist_ok=True)
        hash_object = hashlib.md5(self.audio_file_path.encode())
        hashed_filename = hash_object.hexdigest() + ".txt"
        cache_file = os.path.join(cache_dir, hashed_filename)

        if os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                cached_tempo = int(f.read().strip())
            self.result.emit(cached_tempo)
            self.quit()
            return

        beat_processor = RNNBeatProcessor()
        beats = beat_processor(self.audio_file_path)
        tempo_processor = TempoEstimationProcessor(fps=200)
        tempos = tempo_processor(beats)
        if len(tempos):
            top_tempo = tempos[0][0]
            adjusted_tempo = self.adjust_tempo(top_tempo)
            with open(cache_file, "w") as f:
                f.write(str(round(adjusted_tempo)))
            self.result.emit(round(adjusted_tempo))
        else:
            self.result.emit(0)
        self.quit()

    def adjust_tempo(self, tempo):
        while tempo < 70:
            tempo *= 2
        while tempo > 190:
            tempo /= 2
        return tempo
