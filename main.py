from interface import *
from chords import *
from key import *
from tempo import *

class MainWindow(QMainWindow):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.ui = Ui_MainWindow()
        self.ui.setupUi(self)
        self.setWindowFlags(Qt.FramelessWindowHint)
        enable_window_shadow(self)
        self.setWindowIcon(QIcon(u":/icons/chord.png"))
        self.show()

        self.offset = None
        self.chords = []
        self.chord_index = 0
        self.start_time = None
        self.is_muted = False
        self.is_dark = True
        self.load_stack = 1
        self.setAcceptDrops(True)

        self.player = QMediaPlayer()
        self.player.positionChanged.connect(self.update_chords)
        self.player.durationChanged.connect(self.update_duration)
        self.player.stateChanged.connect(self.update_state)
        self.player.mediaStatusChanged.connect(self.update_media)
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_position)
        
        self.ui.minimizeBtn.clicked.connect(lambda: self.showMinimized())
        self.ui.closeBtn.clicked.connect(lambda: self.close())
        self.ui.mediaOpenBtn.clicked.connect(self.load_audio)
        self.ui.mediaPlayBtn.clicked.connect(self.play_pause)
        self.ui.currentChordBtn.clicked.connect(self.play_pause)
        self.ui.prePrevChordBtn.clicked.connect(self.play_pause)
        self.ui.prevChordBtn.clicked.connect(self.play_pause)
        self.ui.nxtChordBtn.clicked.connect(self.play_pause)
        self.ui.postNxtChordBtn.clicked.connect(self.play_pause)
        self.ui.themeBtn.clicked.connect(self.toggle_theme)
        self.ui.saveChordsBtn.clicked.connect(self.export_chords)
        self.ui.seekNxtBtn.clicked.connect(lambda: self.seek(10000))
        self.ui.seekPrevBtn.clicked.connect(lambda: self.seek(-10000))
        self.ui.mediaMuteBtn.clicked.connect(self.mute_unmute)
        self.ui.githubBtn.clicked.connect(self.redirectGithub)
        self.ui.volumeSlider.sliderMoved.connect(self.set_volume)
        self.ui.mediaProgressSlider.sliderPressed.connect(lambda: self.timer.stop())
        self.ui.mediaProgressSlider.sliderMoved.connect(self.set_position)
        self.ui.mediaProgressSlider.sliderReleased.connect(lambda: self.timer.start(100))       

    def toggle_theme(self):
        self.is_dark = not self.is_dark
        self.ui.themeBtn.setIcon(QIcon(":/icons/sun.svg"if self.is_dark else":/icons/moon.svg"))
        self.setStyleSheet(dark_theme) if self.is_dark else self.setStyleSheet(light_theme)
        self.load_stack = 1 if self.is_dark else 2

    def update_position(self):
        position = self.player.position()
        self.ui.mediaProgressSlider.setValue(position)
        self.ui.currentPlayedLabel.setText(f'{position // 60000}:{(position % 60000) // 1000:02d}')
        self.update_chords(position)

    def update_duration(self, duration):
        self.ui.mediaProgressSlider.setRange(0, duration)
        self.ui.mediaDurationLabel.setText(f'{duration // 60000}:{(duration % 60000) // 1000:02d}')

    def play_pause(self):
        if self.player.state() == QMediaPlayer.PlayingState:
            self.player.pause()
            self.timer.stop()
        else:
            self.player.play()
            self.timer.start(100)

    def seek(self, milliseconds):
        new_position = self.player.position() + milliseconds
        if new_position < 0 or new_position > self.player.duration():
            self.set_position(0)
            self.player.stop()
        else:
            self.player.setPosition(new_position)
            self.update_chords(new_position)

    def set_position(self, position):
        self.player.setPosition(position)
        self.update_chords(position / 1000.0)
        
    def mute_unmute(self):
        self.is_muted = not self.is_muted
        self.player.setMuted(self.is_muted)
        self.ui.mediaMuteBtn.setIcon(QIcon(":/icons/volume-x.svg"if self.is_muted else":/icons/volume-2.svg"))
        self.ui.volumeSlider.setEnabled(not self.is_muted)

    def update_chords(self, position):
        current_time = position  # position is in milliseconds
        if self.chord_index > 0 and self.chord_index < len(self.chords) and self.chords[self.chord_index][1] > current_time / 1000.0:
            self.chord_index = 0  # Reset index if seeking backward
        while self.chord_index < len(self.chords) and self.chords[self.chord_index][1] <= current_time / 1000.0:
            self.chord_index += 1

        pre_previous_chord = previous_chord = current_chord = next_chord = post_next_chord = None

        if self.chord_index < len(self.chords):
            current_chord = self.chords[self.chord_index][2]
            current_chord_start_time = self.chords[self.chord_index][0]
            current_chord_end_time = self.chords[self.chord_index][1]
            
            if self.chord_index > 0:
                previous_chord = self.chords[self.chord_index - 1][2]
            if self.chord_index > 1:
                pre_previous_chord = self.chords[self.chord_index - 2][2]
            if self.chord_index + 1 < len(self.chords):
                next_chord = self.chords[self.chord_index + 1][2]
            if self.chord_index + 2 < len(self.chords):
                post_next_chord = self.chords[self.chord_index + 2][2]

            chord_duration = current_chord_end_time - current_chord_start_time
            time_elapsed = (current_time / 1000.0) - current_chord_start_time
            if chord_duration > 0:
                slider_value = (time_elapsed / chord_duration) * 100
                self.ui.chordSlider.setValue(int(slider_value))
        
        self.ui.prePrevChordBtn.setText(f"{pre_previous_chord}" if pre_previous_chord else "")
        self.ui.prevChordBtn.setText(f"{previous_chord}" if previous_chord else "")
        self.ui.currentChordBtn.setText(f"{current_chord}" if current_chord else "")
        self.ui.nxtChordBtn.setText(f"{next_chord}" if next_chord else "")
        self.ui.postNxtChordBtn.setText(f"{post_next_chord}" if post_next_chord else "")

    def update_media(self, status):
        if status == QMediaPlayer.EndOfMedia:
            self.timer.stop()
            self.set_position(0)
            self.chord_index = 0
            self.update_chords(0)
            self.player.stop()
            self.ui.mediaPlayBtn.setIcon(QIcon(u":/icons/play.svg"))

    def set_volume(self, volume):
        self.player.setVolume(volume)

    def update_state(self, state):
        icons = {QMediaPlayer.PlayingState: "pause.svg", QMediaPlayer.PausedState: "play.svg"}
        self.ui.mediaPlayBtn.setIcon(QIcon(f":/icons/{icons.get(state, 'play.svg')}"))

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.offset = event.pos()

    def mouseMoveEvent(self, event):
        if self.offset is not None and event.buttons() == Qt.LeftButton:
            self.move(self.pos() + event.pos() - self.offset)

    def mouseReleaseEvent(self, event):
        self.offset = None

    def load_audio(self, fileName=None):
        if not fileName:
            options = QFileDialog.Options()
            fileName, _ = QFileDialog.getOpenFileName(self, "Open Audio File", "", "Audio Files (*.wav *.mp3 *.m4a *.aac)", options=options)
        if fileName:
            self.timer.stop()
            self.player.stop()
            self.player.setMedia(QMediaContent())
            self.ui.mediaProgressSlider.setValue(0)
            self.chord_index = 0
            self.ui.keyLabel.clear()
            self.audio_file = fileName
            self.media_title = fileName.split("/")[-1].rsplit(".", 1)[0]
            self.ui.mediaTitleLabel.setText(self.media_title)
            self.ui.errGif.start()
            self.ui.loadingGif.start()
            self.ui.appStacks.setCurrentIndex(self.load_stack)
            self.chord_thread = ChordRecognitionThread(fileName)
            self.chord_thread.result.connect(self.on_chords_recognized)
            self.chord_thread.start()
            self.tempo_thread = TempoDetectionThread(fileName)
            self.tempo_thread.result.connect(self.on_tempo_detected)
            self.tempo_thread.start()
            self.key_thread = KeyRecognitionThread(fileName)
            self.key_thread.result.connect(self.on_key_recognized)
            self.key_thread.start()
            self.player.setMedia(QMediaContent(QUrl.fromLocalFile(fileName)))

    def on_tempo_detected(self, tempo):
        self.tempo = tempo
        current_text = self.ui.keyLabel.text()
        if current_text:
            updated_text = f"{current_text}  |  {tempo} BPM"
            self.ui.keyLabel.setText(updated_text)
        else: self.ui.keyLabel.setText(f"{tempo} BPM")
        self.ui.keyLabel.show()

    def on_chords_recognized(self, chords):
        self.chords = chords
        self.ui.appStacks.setCurrentIndex(0)
        self.ui.errGif.stop()
        self.ui.loadingGif.stop()
        self.play_pause()
        self.ui.mediaProgressSlider.setEnabled(True)
        self.ui.chordSlider.setEnabled(True)
        self.ui.mediaPlayBtn.setEnabled(True)
        self.ui.seekPrevBtn.setEnabled(True)
        self.ui.seekNxtBtn.setEnabled(True)
        self.ui.saveChordsBtn.setEnabled(True)

    def on_key_recognized(self, key):
        self.key = key
        current_text = self.ui.keyLabel.text()
        if current_text:
            updated_text = f"{current_text}  |  {key}"
            self.ui.keyLabel.setText(updated_text)
        else: self.ui.keyLabel.setText(key)
        self.ui.keyLabel.show()

    def export_chords(self):
        if self.chords:
            os.makedirs('./export', exist_ok=True)
            file_path = f"./export/{self.media_title}.txt"
            with open(file_path, 'w') as file:
                for chord in self.chords:
                    start_time, end_time, chord_label = chord
                    file.write(f"({self.format_time(start_time)} - {self.format_time(end_time)}): {chord_label}\n")

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        urls = event.mimeData().urls()
        if urls:
            self.load_audio(urls[0].toLocalFile())

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Escape:
            self.ui.closeBtn.click()
        if event.key() == Qt.Key_Minus:
            self.ui.minimizeBtn.click()
        if event.key() == Qt.Key_T:
            self.ui.themeBtn.click()
        if event.key() == Qt.Key_P:
            self.ui.mediaPlayBtn.click()
        if event.key() == Qt.Key_V:
            self.ui.mediaPlayBtn.click()
        if event.key() == Qt.Key_Left:
            self.ui.seekPrevBtn.click()
        if event.key() == Qt.Key_Right:
            self.ui.seekNxtBtn.click()
        if event.key() == Qt.Key_C:
            self.ui.seekPrevBtn.click()
        if event.key() == Qt.Key_B:
            self.ui.seekNxtBtn.click()
        if event.key() == Qt.Key_M:
            self.ui.mediaMuteBtn.click()
        if event.key() == Qt.Key_O:
            self.ui.mediaOpenBtn.click()
        if event.key() == Qt.Key_E:
            self.ui.saveChordsBtn.click()
        if event.key() == Qt.Key_R:
            self.ui.githubBtn.click()
        

    def redirectGithub(self):
        import webbrowser
        webbrowser.open_new_tab("https://github.com/chinmaykrishnroy/DeChord")

    def format_time(self, s):
        seconds = (s) % 60
        minutes = (s / 60) % 60
        hours = (s / (60 * 60)) % 24
        if int(hours) > 0:
            return "%02d:%02d:%02d" % (hours, minutes, round(seconds))
        else:
            return "%02d:%02d" % (minutes, round(seconds))



def handle_exception(exc_type, exc_value, exc_traceback):
    # Print exception details or handle them as needed
    traceback.print_exception(exc_type, exc_value, exc_traceback)

import traceback
import sys
sys.excepthook = handle_exception


if __name__ == "__main__":

    app = QApplication(sys.argv)
    window = MainWindow()
    sys.exit(app.exec())
