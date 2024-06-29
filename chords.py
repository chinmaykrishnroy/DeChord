from PyQt5.QtCore import QThread, pyqtSignal, QMutex
import madmom

class ChordRecognitionThread(QThread):
    result = pyqtSignal(list)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path
        self.mutex = QMutex()

    def run(self):
        feat_processor = madmom.features.chords.CNNChordFeatureProcessor()
        recog_processor = madmom.features.chords.CRFChordRecognitionProcessor()
        feats = feat_processor(self.audio_path)
        chords = recog_processor(feats)
        formatted_chords = []
        for chord in chords:
            start_time, end_time, chord_label = chord
            if ":maj" in chord_label:
                chord_label = chord_label.replace(":maj", "")
            elif ":min" in chord_label:
                chord_label = chord_label.replace(":min", "m")
            formatted_chords.append((start_time, end_time, chord_label))
        self.mutex.lock()
        self.result.emit(formatted_chords)
        self.mutex.unlock()
        self.quit()