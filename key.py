from PyQt5.QtCore import QThread, pyqtSignal, QMutex
import madmom

key_mapping = [
    "C / Am", "C# / A#m", "D / Bm", "D# / Cm",
    "E / C#m", "F / Dm", "F# / D#m", "G / Em",
    "G# / Fm", "A / F#m", "A# / Gm", "B /G#m"
]

class KeyRecognitionThread(QThread):
    result = pyqtSignal(str)

    def __init__(self, audio_path):
        super().__init__()
        self.audio_path = audio_path
        self.mutex = QMutex()

    def run(self):
        key_processor = madmom.features.key.CNNKeyRecognitionProcessor()
        key = key_processor(self.audio_path)
        most_likely_key_index = key.argmax()
        most_likely_key = key_mapping[most_likely_key_index]
        print(f"Key: {most_likely_key}")
        self.mutex.lock()
        self.result.emit(most_likely_key)
        self.mutex.unlock()
        self.quit()