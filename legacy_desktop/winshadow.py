import sys
from PyQt5.QtCore import Qt, QPoint, QMargins
from PyQt5.QtGui import QColor
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QMainWindow, QGraphicsDropShadowEffect

USE_NATIVE_WINDOWS_SHADOW = True 

_DEFAULT_SHADOW_RADIUS = 12  
_DEFAULT_SHADOW_OFFSET = (0, 8)
_DEFAULT_SHADOW_COLOR = QColor(0, 0, 0, 160)


class _ShadowHost(QWidget):
    def __init__(self, parent=None, *, shadow_radius, shadow_offset, shadow_color):
        super().__init__(parent)
        self.setAttribute(Qt.WA_TranslucentBackground)
        layout = QVBoxLayout(self)
        m = shadow_radius
        layout.setContentsMargins(QMargins(m, m, m, m))
        layout.setSpacing(0)

        self.card = QWidget(self)
        self.card.setObjectName("_shadow_card")
        self.card.setAttribute(Qt.WA_StyledBackground, True)

        effect = QGraphicsDropShadowEffect(self.card)
        effect.setBlurRadius(shadow_radius)
        effect.setOffset(*shadow_offset)
        effect.setColor(shadow_color)
        self.card.setGraphicsEffect(effect)

        self.card.setStyleSheet("#_shadow_card { background: palette(window); }")
        layout.addWidget(self.card)
        self._drag_pos = None

    def mousePressEvent(self, e):
        if e.button() == Qt.LeftButton:
            top = self.window()
            if top.windowFlags() & Qt.FramelessWindowHint:
                self._drag_pos = e.globalPos() - top.frameGeometry().topLeft()
            e.accept()

    def mouseMoveEvent(self, e):
        if self._drag_pos and (e.buttons() & Qt.LeftButton):
            self.window().move(e.globalPos() - self._drag_pos)
            e.accept()

    def mouseReleaseEvent(self, e):
        self._drag_pos = None
        super().mouseReleaseEvent(e)


def _apply_client_shadow(win: QMainWindow, *, shadow_radius, shadow_offset, shadow_color):
    if getattr(win, "_shadow_applied", False):
        return
    win._shadow_applied = True
    win.setAttribute(Qt.WA_TranslucentBackground)
    win.setWindowFlag(Qt.FramelessWindowHint)

    existing = win.styleSheet() or ""
    if "background:" not in existing:
        win.setStyleSheet(existing + "\nQMainWindow { background: transparent; }\n")

    host = _ShadowHost(win, shadow_radius=shadow_radius,
                       shadow_offset=shadow_offset,
                       shadow_color=shadow_color)
    old_central = win.centralWidget()
    layout = QVBoxLayout(host.card)
    layout.setContentsMargins(0, 0, 0, 0)
    if old_central:
        old_central.setParent(host.card)
        layout.addWidget(old_central)
    win.setCentralWidget(host)


def _apply_windows_native_shadow(win):
    try:
        import ctypes as c
        from ctypes.wintypes import HWND
        h = HWND(int(win.winId()))
        m = (c.c_int * 4)(-1, -1, -1, -1)
        dwm = c.windll.dwmapi
        dwm.DwmExtendFrameIntoClientArea(h, c.byref(m))
        dwm.DwmSetWindowAttribute(h, c.c_int(2), c.byref(c.c_int(2)), c.sizeof(c.c_int))
    except Exception:
        pass


def enable_window_shadow(win):
    if sys.platform == "win32" and USE_NATIVE_WINDOWS_SHADOW:
        _apply_windows_native_shadow(win)
    else:
        _apply_client_shadow(win,
                             shadow_radius=_DEFAULT_SHADOW_RADIUS,
                             shadow_offset=_DEFAULT_SHADOW_OFFSET,
                             shadow_color=_DEFAULT_SHADOW_COLOR)
