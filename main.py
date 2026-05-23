import csv
import json
import os
import sys
import traceback

from PyQt5.QtCore import QEasingCurve, QParallelAnimationGroup, QPropertyAnimation, Qt, QTimer, QUrl
from PyQt5.QtGui import QFontMetrics, QIcon
from PyQt5.QtMultimedia import QMediaContent, QMediaPlayer
from PyQt5.QtWidgets import QApplication, QFileDialog, QMainWindow

from audio_runtime import ensure_ffmpeg_available, friendly_audio_error, playback_audio_path
from chord_types import parse_chord_label
from chords import ChordRecognitionThread
from export_utils import build_chord_export_rows
from interface import Ui_MainWindow
from key import KeyRecognitionThread
from tempo import TempoDetectionThread
from theme import dark_theme, light_theme
from timeline import chord_index_at_position
from winshadow import enable_window_shadow

MAIN_PAGE_INDEX = 0
LOADING_PAGE_INDEX = 1
ERROR_PAGE_INDEX = 2

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
        self.analysis_id = 0
        self.key = None
        self.tempo = None
        self.analysis_notes = []
        self.analysis_threads = []
        self.current_chord_display_index = None
        self.chord_transition_group = None
        self.chord_lane_target_positions = None
        self.chord_animation_enabled = self.env_flag("DECHORD_ANIMATE_CHORDS", default=False)
        self.chord_engine_name = os.environ.get("DECHORD_CHORD_ENGINE", "lv-chordia")
        self.chord_dict_name = os.environ.get("DECHORD_CHORD_DICT", "submission")
        self.setAcceptDrops(True)

        self.player = QMediaPlayer()
        self.player.positionChanged.connect(self.update_chords)
        self.player.durationChanged.connect(self.update_duration)
        self.player.stateChanged.connect(self.update_state)
        self.player.mediaStatusChanged.connect(self.update_media)
        self.player.error.connect(self.on_playback_error)
        
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
        duration = self.player.duration()
        if duration <= 0:
            return
        new_position = max(0, min(self.player.position() + milliseconds, duration))
        self.player.setPosition(new_position)
        self.update_chords(new_position)

    def set_position(self, position):
        self.player.setPosition(position)
        self.update_chords(position)
        
    def mute_unmute(self):
        self.is_muted = not self.is_muted
        self.player.setMuted(self.is_muted)
        self.ui.mediaMuteBtn.setIcon(QIcon(":/icons/volume-x.svg"if self.is_muted else":/icons/volume-2.svg"))
        self.ui.volumeSlider.setEnabled(not self.is_muted)

    def update_chords(self, position):
        current_time = position  # position is in milliseconds
        previous_display_index = self.current_chord_display_index
        self.chord_index = chord_index_at_position(self.chords, current_time, self.chord_index)

        pre_previous_chord = previous_chord = current_chord = next_chord = post_next_chord = None
        current_chord_progress = 0.0

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
                current_chord_progress = max(0.0, min(1.0, time_elapsed / chord_duration))
                self.ui.chordSlider.setValue(int(current_chord_progress * 100))
        else:
            self.ui.chordSlider.setValue(0)
            self.current_chord_display_index = None

        transition_direction = None
        if current_chord and previous_display_index is not None:
            index_delta = self.chord_index - previous_display_index
            if index_delta in (-1, 1):
                transition_direction = index_delta

        self.set_chord_button_text(self.ui.prePrevChordBtn, pre_previous_chord, 20)
        self.set_chord_button_text(self.ui.prevChordBtn, previous_chord, 30)
        self.set_chord_button_text(self.ui.currentChordBtn, current_chord, 40)
        self.set_chord_button_text(self.ui.nxtChordBtn, next_chord, 30)
        self.set_chord_button_text(self.ui.postNxtChordBtn, post_next_chord, 20)
        if current_chord:
            self.current_chord_display_index = self.chord_index
            if self.chord_animation_enabled and transition_direction:
                self.animate_chord_lane(transition_direction)
        self.update_chord_info(current_chord)

    def env_flag(self, name, default=False):
        value = os.environ.get(name)
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

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
            self.analysis_id += 1
            analysis_id = self.analysis_id
            self.timer.stop()
            self.player.stop()
            self.player.setMedia(QMediaContent())
            if self.chord_transition_group is not None:
                self.chord_transition_group.stop()
            self.ui.mediaProgressSlider.setValue(0)
            self.chord_index = 0
            self.current_chord_display_index = None
            self.chords = []
            self.key = None
            self.tempo = None
            self.active_chord_engine = None
            self.analysis_notes = []
            self.ui.keyLabel.clear()
            self.ui.chordTypeLabel.clear()
            self.ui.chordNotesLabel.clear()
            self.ui.chordDetailsWidget.hide()
            self.audio_file = fileName
            self.media_title = os.path.basename(fileName).rsplit(".", 1)[0]
            self.ui.mediaTitleLabel.setText(self.media_title)
            self.ui.errGif.start()
            self.ui.loadingGif.start()
            self.ui.errLabel.setText("Analyzing Chords")
            self.ui.appStacks.setCurrentIndex(LOADING_PAGE_INDEX)
            self.set_playback_controls_enabled(False)
            if not ensure_ffmpeg_available():
                self.on_analysis_error(
                    analysis_id,
                    "chords",
                    "Could not find FFmpeg. Close the app, run run.bat once to install/update dependencies, then try again.",
                )
                return
            try:
                self.playback_file = playback_audio_path(fileName)
            except Exception as e:
                self.on_analysis_error(analysis_id, "chords", f"Could not prepare audio for playback: {e}")
                return
            self.chord_thread = ChordRecognitionThread(fileName, self.chord_engine_name, self.chord_dict_name)
            self.chord_thread.engine_ready.connect(lambda engine, analysis_id=analysis_id: self.on_chord_engine_ready(analysis_id, engine))
            self.chord_thread.result.connect(lambda chords, analysis_id=analysis_id: self.on_chords_recognized(analysis_id, chords))
            self.chord_thread.error.connect(lambda message, analysis_id=analysis_id: self.on_analysis_error(analysis_id, "chords", message))
            self.start_analysis_thread(self.chord_thread)
            self.tempo_thread = TempoDetectionThread(fileName)
            self.tempo_thread.result.connect(lambda tempo, analysis_id=analysis_id: self.on_tempo_detected(analysis_id, tempo))
            self.tempo_thread.error.connect(lambda message, analysis_id=analysis_id: self.on_analysis_error(analysis_id, "tempo", message))
            self.start_analysis_thread(self.tempo_thread)
            self.key_thread = KeyRecognitionThread(fileName)
            self.key_thread.result.connect(lambda key, analysis_id=analysis_id: self.on_key_recognized(analysis_id, key))
            self.key_thread.error.connect(lambda message, analysis_id=analysis_id: self.on_analysis_error(analysis_id, "key", message))
            self.start_analysis_thread(self.key_thread)
            self.player.setMedia(QMediaContent(QUrl.fromLocalFile(self.playback_file)))

    def on_tempo_detected(self, analysis_id, tempo):
        if not self.is_active_analysis(analysis_id):
            return
        self.tempo = tempo
        self.remove_analysis_note("Tempo unavailable")
        self.refresh_key_tempo_label()

    def on_chord_engine_ready(self, analysis_id, engine_name):
        if not self.is_active_analysis(analysis_id):
            return
        self.active_chord_engine = engine_name
        self.refresh_key_tempo_label()

    def on_chords_recognized(self, analysis_id, chords):
        if not self.is_active_analysis(analysis_id):
            return
        self.chords = chords
        self.ui.appStacks.setCurrentIndex(MAIN_PAGE_INDEX)
        self.ui.errGif.stop()
        self.ui.loadingGif.stop()
        self.set_playback_controls_enabled(True)
        self.start_playback()

    def on_key_recognized(self, analysis_id, key):
        if not self.is_active_analysis(analysis_id):
            return
        self.key = key
        self.remove_analysis_note("Key unavailable")
        self.refresh_key_tempo_label()

    def on_analysis_error(self, analysis_id, source, message):
        if not self.is_active_analysis(analysis_id):
            return
        if source == "chords":
            self.ui.loadingGif.stop()
            self.ui.errGif.start()
            self.ui.errLabel.setText(friendly_audio_error(message))
            self.ui.appStacks.setCurrentIndex(ERROR_PAGE_INDEX)
            self.set_playback_controls_enabled(False)
            return

        note = "Key unavailable" if source == "key" else "Tempo unavailable"
        if note not in self.analysis_notes:
            self.analysis_notes.append(note)
        self.refresh_key_tempo_label()

    def refresh_key_tempo_label(self):
        parts = []
        if self.key:
            parts.append(self.key)
        if self.tempo is not None:
            parts.append(f"{self.tempo} BPM")
        if getattr(self, "active_chord_engine", None):
            parts.append(f"Engine: {self.active_chord_engine}")
        parts.extend(self.analysis_notes)
        if parts:
            self.ui.keyLabel.setText("  |  ".join(parts))
            self.ui.keyLabel.show()
        else:
            self.ui.keyLabel.hide()

    def remove_analysis_note(self, note):
        if note in self.analysis_notes:
            self.analysis_notes.remove(note)

    def is_active_analysis(self, analysis_id):
        return analysis_id == self.analysis_id

    def set_playback_controls_enabled(self, enabled):
        self.ui.mediaProgressSlider.setEnabled(enabled)
        self.ui.chordSlider.setEnabled(enabled)
        self.ui.mediaPlayBtn.setEnabled(enabled)
        self.ui.seekPrevBtn.setEnabled(enabled)
        self.ui.seekNxtBtn.setEnabled(enabled)
        self.ui.saveChordsBtn.setEnabled(enabled)

    def animate_chord_lane(self, direction):
        buttons = [
            self.ui.prePrevChordBtn,
            self.ui.prevChordBtn,
            self.ui.currentChordBtn,
            self.ui.nxtChordBtn,
            self.ui.postNxtChordBtn,
        ]
        if not all(button.isVisible() for button in buttons):
            return

        if self.chord_transition_group is not None:
            self.chord_transition_group.stop()
            if self.chord_lane_target_positions is not None:
                for button, target in zip(buttons, self.chord_lane_target_positions):
                    button.move(target)

        targets = [button.pos() for button in buttons]
        self.chord_lane_target_positions = targets

        if direction > 0:
            starts = [targets[1], targets[2], targets[3], targets[4], targets[4]]
        else:
            starts = [targets[0], targets[0], targets[1], targets[2], targets[3]]

        group = QParallelAnimationGroup(self)
        for button, start, target in zip(buttons, starts, targets):
            button.move(start)
            button.raise_()
            animation = QPropertyAnimation(button, b"pos", group)
            animation.setStartValue(start)
            animation.setEndValue(target)
            animation.setDuration(260)
            animation.setEasingCurve(QEasingCurve.OutCubic)
            group.addAnimation(animation)

        group.finished.connect(lambda: [button.move(target) for button, target in zip(buttons, targets)])
        self.chord_transition_group = group
        group.start()

    def set_chord_button_text(self, button, chord_label, base_size):
        label = chord_label or ""
        button.setText(label)

        font = button.font()
        if hasattr(font, "setFamilies"):
            font.setFamilies(["Segoe UI", "Arial", "Tahoma"])
        else:
            font.setFamily("Segoe UI")
        font.setBold(True)
        button_width = button.width() if button.width() > 0 else button.minimumWidth()
        button_height = button.height() if button.height() > 0 else button.minimumHeight()
        if button.maximumWidth() < 16777215:
            button_width = min(button_width, button.maximumWidth())
        if button.maximumHeight() < 16777215:
            button_height = min(button_height, button.maximumHeight())
        button_width = max(button_width, button.minimumWidth())
        button_height = max(button_height, button.minimumHeight())
        max_width = max(16, button_width - 8)
        max_height = max(16, button_height - 8)

        for size in range(base_size, 9, -1):
            font.setPixelSize(size)
            metrics = QFontMetrics(font)
            if metrics.horizontalAdvance(label) <= max_width and metrics.height() <= max_height:
                break
        else:
            font.setPixelSize(10)

        button.setFont(font)

    def update_chord_info(self, chord_label):
        if not chord_label:
            self.ui.chordDetailsWidget.hide()
            return

        chord = parse_chord_label(chord_label)
        if chord.is_no_chord:
            self.ui.chordTypeLabel.setText("Type: No chord")
            self.ui.chordNotesLabel.setText("Notes: -")
        elif chord.root is None:
            self.ui.chordTypeLabel.setText("Type: Unknown")
            self.ui.chordNotesLabel.setText("Notes: -")
        else:
            notes = " ".join(chord.notes) if chord.notes else "-"
            bass = f" | Bass: {chord.bass}" if chord.bass else ""
            self.ui.chordTypeLabel.setText(f"Type: {chord.quality_name}")
            self.ui.chordNotesLabel.setText(f"Notes: {notes}{bass}")
        self.ui.chordDetailsWidget.show()

    def start_playback(self):
        self.player.play()
        self.timer.start(100)
        QTimer.singleShot(500, self.check_playback_started)

    def check_playback_started(self):
        if self.chords and self.player.state() != QMediaPlayer.PlayingState:
            error_message = self.player.errorString()
            if error_message:
                self.ui.errLabel.setText(f"Playback could not start: {error_message}")
            else:
                self.ui.errLabel.setText("Playback could not start. Try pressing Play again.")
            self.ui.errGif.start()
            self.ui.appStacks.setCurrentIndex(ERROR_PAGE_INDEX)

    def on_playback_error(self, error):
        if error == QMediaPlayer.NoError:
            return
        message = self.player.errorString() or "The audio backend could not play this file."
        self.ui.errLabel.setText(f"Playback error: {message}")
        self.ui.errGif.start()
        self.ui.appStacks.setCurrentIndex(ERROR_PAGE_INDEX)

    def start_analysis_thread(self, thread):
        self.analysis_threads.append(thread)
        thread.finished.connect(lambda thread=thread: self.forget_analysis_thread(thread))
        thread.start()

    def forget_analysis_thread(self, thread):
        if thread in self.analysis_threads:
            self.analysis_threads.remove(thread)

    def export_chords(self):
        if self.chords:
            os.makedirs('./export', exist_ok=True)
            rows = self.chord_export_rows()
            txt_path = f"./export/{self.media_title}.txt"
            csv_path = f"./export/{self.media_title}.csv"
            json_path = f"./export/{self.media_title}.json"

            with open(txt_path, 'w', encoding="utf-8") as file:
                for row in rows:
                    file.write(f"({row['start']} - {row['end']}): {row['label']} | {row['quality']} | {row['notes']}\n")

            with open(csv_path, 'w', newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=["start", "end", "label", "quality", "notes", "bass"])
                writer.writeheader()
                writer.writerows(rows)

            with open(json_path, 'w', encoding="utf-8") as file:
                json.dump(rows, file, indent=2)

    def chord_export_rows(self):
        return build_chord_export_rows(self.chords, self.format_time)

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

sys.excepthook = handle_exception


if __name__ == "__main__":

    app = QApplication(sys.argv)
    window = MainWindow()
    sys.exit(app.exec())
