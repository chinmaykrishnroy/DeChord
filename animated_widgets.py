from PyQt5.QtCore import QEasingCurve, QPointF, QPropertyAnimation, Qt, pyqtProperty
from PyQt5.QtGui import QColor, QPainter, QPen
from PyQt5.QtWidgets import QPushButton


class AnimatedChordButton(QPushButton):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._progress = 0.0
        self._pulse = 0.0
        self._pulse_animation = QPropertyAnimation(self, b"pulseAmount", self)
        self._pulse_animation.setDuration(420)
        self._pulse_animation.setStartValue(1.0)
        self._pulse_animation.setEndValue(0.0)
        self._pulse_animation.setEasingCurve(QEasingCurve.OutCubic)
        self._progress_animation = QPropertyAnimation(self, b"progressAmount", self)
        self._progress_animation.setDuration(130)
        self._progress_animation.setEasingCurve(QEasingCurve.OutCubic)

    def get_progress(self):
        return self._progress

    def set_progress(self, value):
        value = max(0.0, min(1.0, float(value)))
        if self._progress == value:
            return
        self._progress = value
        self.update()

    progressAmount = pyqtProperty(float, fget=get_progress, fset=set_progress)

    def animate_progress(self, value):
        value = max(0.0, min(1.0, float(value)))
        if value < self._progress - 0.2:
            self._progress_animation.stop()
            self.set_progress(value)
            return

        self._progress_animation.stop()
        self._progress_animation.setStartValue(self._progress)
        self._progress_animation.setEndValue(value)
        self._progress_animation.start()

    def get_pulse(self):
        return self._pulse

    def set_pulse(self, value):
        self._pulse = max(0.0, min(1.0, float(value)))
        self.update()

    pulseAmount = pyqtProperty(float, fget=get_pulse, fset=set_pulse)

    def trigger_pulse(self):
        self._pulse_animation.stop()
        self._pulse_animation.setStartValue(1.0)
        self._pulse_animation.setEndValue(0.0)
        self._pulse_animation.start()

    def paintEvent(self, event):
        super().paintEvent(event)
        if not self.text():
            return

        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        rect = self.rect().adjusted(3, 3, -3, -3)
        if rect.width() <= 0 or rect.height() <= 0:
            return

        if self._pulse > 0:
            pulse_color = QColor(247, 92, 3)
            pulse_color.setAlpha(int(90 * self._pulse))
            pulse_pen = QPen(pulse_color, 2 + (4 * self._pulse))
            pulse_pen.setCapStyle(Qt.RoundCap)
            pulse_pen.setJoinStyle(Qt.RoundJoin)
            painter.setPen(pulse_pen)
            painter.drawRoundedRect(rect, 8, 8)

        base_color = QColor(255, 255, 255, 38)
        painter.setPen(QPen(base_color, 1))
        painter.drawRoundedRect(rect, 8, 8)

        tail_steps = 12
        tail_width = 0.11
        for step in range(tail_steps):
            segment_start = self._progress - tail_width + (tail_width * step / tail_steps)
            segment_end = self._progress - tail_width + (tail_width * (step + 1) / tail_steps)
            p1 = self._perimeter_point(segment_start, rect)
            p2 = self._perimeter_point(segment_end, rect)

            glow_color = QColor(247, 92, 3)
            glow_color.setAlpha(35 + int(165 * (step + 1) / tail_steps))
            pen = QPen(glow_color, 2.0 + (1.6 * step / tail_steps))
            pen.setCapStyle(Qt.RoundCap)
            painter.setPen(pen)
            painter.drawLine(p1, p2)

    def _perimeter_point(self, progress, rect):
        width = rect.width()
        height = rect.height()
        perimeter = 2 * (width + height)
        distance = (progress % 1.0) * perimeter

        if distance <= width:
            return QPointF(rect.left() + distance, rect.top())

        distance -= width
        if distance <= height:
            return QPointF(rect.right(), rect.top() + distance)

        distance -= height
        if distance <= width:
            return QPointF(rect.right() - distance, rect.bottom())

        distance -= width
        return QPointF(rect.left(), rect.bottom() - distance)
