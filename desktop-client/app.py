'''
app.py — Spatial_Tracer Desktop Overlay

Transparent floating overlay that:
  - Runs HeadlessHandTracker + GestureDetector + AirInputDriver in-process
  - Shows small camera panel with hand skeleton
  - Shows active gesture badge + cursor indicator
  - Controls real OS mouse & keyboard via air gestures

Usage:
    python desktop-client/app.py
    (or via: python main.py desktop)
'''

import sys
import time
import threading
from pathlib import Path

import cv2
import numpy as np
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QLabel, QPushButton,
    QVBoxLayout, QHBoxLayout, QFrame, QSystemTrayIcon, QMenu, QAction,
)
from PyQt5.QtCore import (
    Qt, QTimer, pyqtSignal, QThread, QPoint, QSize, QRect,
)
from PyQt5.QtGui import (
    QPainter, QColor, QPen, QBrush, QFont, QImage, QPixmap, QIcon,
    QRadialGradient, QPainterPath,
)

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from engine.headless_hand_tracer import HeadlessHandTracker
from engine.gesture_detector import GestureDetector
from engine.air_input_driver import AirInputDriver

# ── Screen resolution ───────────────────────────────────────────
try:
    import ctypes
    user32 = ctypes.windll.user32
    SCREEN_W = user32.GetSystemMetrics(0)
    SCREEN_H = user32.GetSystemMetrics(1)
except Exception:
    SCREEN_W, SCREEN_H = 1920, 1080


# ═══════════════════════════════════════════════════════════════
#  TRACKING THREAD
# ═══════════════════════════════════════════════════════════════

class TrackingThread(QThread):
    """
    Runs HeadlessHandTracker + GestureDetector + AirInputDriver
    in a background thread. Emits frame data + driver results.
    """
    frameReady = pyqtSignal(object, object, object)  # cv2 frame, hand_data, driver_result

    def __init__(self):
        super().__init__()
        self._running = False
        self._tracker = HeadlessHandTracker(
            width=640, height=480,
            max_hands=1,
            detection_confidence=0.5,
            tracking_confidence=0.5,
        )
        self._gesture_detector = GestureDetector()
        self._driver = AirInputDriver(
            screen_w=SCREEN_W,
            screen_h=SCREEN_H,
            smoothing=0.4,
            margin=0.1,
        )

    @property
    def driver(self):
        return self._driver

    def run(self):
        self._running = True
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        if not cap.isOpened():
            self._running = False
            return

        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python.vision import (
            HandLandmarker, HandLandmarkerOptions,
        )
        from mediapipe.tasks.python.vision.hand_landmarker import _RunningMode as RunningMode
        import mediapipe as mp

        model_path = str(_ROOT / "config" / "hand_landmarker.task")
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=RunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        landmarker = HandLandmarker.create_from_options(options)

        frame_idx = 0
        start_time = time.time()

        while self._running:
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

            frame_idx += 1
            ts_ms = int(frame_idx * (1000 / 30))
            result = landmarker.detect_for_video(mp_image, ts_ms)

            elapsed = time.time() - start_time
            fps = frame_idx / elapsed if elapsed > 0 else 0

            # Extract landmarks
            hands_data = []
            if result.hand_landmarks:
                for h_idx, hand_lms in enumerate(result.hand_landmarks):
                    handedness = "Unknown"
                    if result.handedness and h_idx < len(result.handedness):
                        handedness = result.handedness[h_idx][0].category_name

                    landmarks = []
                    for idx, lm in enumerate(hand_lms):
                        landmarks.append({
                            'id': idx,
                            'x': round(lm.x, 5),
                            'y': round(lm.y, 5),
                            'z': round(lm.z, 5),
                        })

                    fingertip_ids = [4, 8, 12, 16, 20]
                    fingertips = []
                    for tid in fingertip_ids:
                        lm = hand_lms[tid]
                        fingertips.append({
                            'id': tid,
                            'x': round(lm.x, 5),
                            'y': round(lm.y, 5),
                            'px_x': int(lm.x * 640),
                            'px_y': int(lm.y * 480),
                        })

                    hands_data.append({
                        'handedness': handedness,
                        'landmarks': landmarks,
                        'fingertips': fingertips,
                    })

            frame_data = {
                'timestamp': round(time.time(), 3),
                'fps': round(fps, 1),
                'frame_index': frame_idx,
                'hands': hands_data,
            }

            # Drive mouse/keyboard
            driver_result = self._driver.process_frame(frame_data)

            self.frameReady.emit(rgb, frame_data, driver_result)

        cap.release()
        landmarker.close()

    def stop(self):
        self._running = False
        self.wait(3000)


# ═══════════════════════════════════════════════════════════════
#  CAMERA PANEL WIDGET
# ═══════════════════════════════════════════════════════════════

class CameraPanel(QWidget):
    """Small camera preview with hand skeleton overlay."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(280, 180)
        self._frame: QImage = None
        self._landmarks = []
        self._gesture = 'IDLE'
        self._fps = 0.0

    def update_frame(self, rgb_frame, landmarks, gesture, fps):
        h, w, ch = rgb_frame.shape
        qimg = QImage(rgb_frame.data, w, h, w * ch, QImage.Format_RGB888)
        self._frame = qimg.scaled(self.width(), self.height(),
                                   Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self._landmarks = landmarks
        self._gesture = gesture
        self._fps = fps
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)

        # Background
        p.setBrush(QColor(0, 0, 0))
        p.setPen(Qt.NoPen)
        p.drawRoundedRect(self.rect(), 10, 10)

        # Camera frame
        if self._frame:
            # Center the frame
            fx = (self.width() - self._frame.width()) // 2
            fy = (self.height() - self._frame.height()) // 2
            p.drawImage(fx, fy, self._frame)

            # Draw skeleton
            if self._landmarks:
                self._draw_skeleton(p, self._landmarks, fx, fy,
                                     self._frame.width(), self._frame.height())
        else:
            p.setPen(QColor(100, 100, 120))
            p.setFont(QFont('JetBrains Mono', 9))
            p.drawText(self.rect(), Qt.AlignCenter, 'No camera')

        # Gesture badge
        if self._gesture and self._gesture != 'IDLE':
            badge_text = self._gesture
            p.setFont(QFont('JetBrains Mono', 8, QFont.Bold))
            fm = p.fontMetrics()
            tw = fm.horizontalAdvance(badge_text) + 16
            bx = self.width() - tw - 6
            by = 6
            p.setBrush(QColor(124, 106, 255, 180))
            p.setPen(Qt.NoPen)
            p.drawRoundedRect(bx, by, tw, 20, 10, 10)
            p.setPen(QColor(255, 255, 255))
            p.drawText(bx + 8, by + 14, badge_text)

        # FPS
        p.setFont(QFont('JetBrains Mono', 7))
        p.setPen(QColor(52, 211, 153))
        p.drawText(8, 16, f'{self._fps:.0f} FPS')

        # Border
        p.setBrush(Qt.NoBrush)
        p.setPen(QPen(QColor(124, 106, 255, 60), 1))
        p.drawRoundedRect(self.rect().adjusted(0, 0, -1, -1), 10, 10)

        p.end()

    def _draw_skeleton(self, p, landmarks, ox, oy, fw, fh):
        conns = [
            (0,1),(1,2),(2,3),(3,4),
            (0,5),(5,6),(6,7),(7,8),
            (0,9),(9,10),(10,11),(11,12),
            (0,13),(13,14),(14,15),(15,16),
            (0,17),(17,18),(18,19),(19,20),
            (5,9),(9,13),(13,17),
        ]

        pen = QPen(QColor(124, 106, 255, 200), 1)
        p.setPen(pen)
        for a, b in conns:
            if a < len(landmarks) and b < len(landmarks):
                ax = ox + int(landmarks[a]['x'] * fw)
                ay = oy + int(landmarks[a]['y'] * fh)
                bx = ox + int(landmarks[b]['x'] * fw)
                by = oy + int(landmarks[b]['y'] * fh)
                p.drawLine(ax, ay, bx, by)

        # Fingertips
        tips = [4, 8, 12, 16, 20]
        for tid in tips:
            if tid < len(landmarks):
                tx = ox + int(landmarks[tid]['x'] * fw)
                ty = oy + int(landmarks[tid]['y'] * fh)
                p.setBrush(QColor(52, 211, 153, 180))
                p.setPen(Qt.NoPen)
                p.drawEllipse(tx - 3, ty - 3, 6, 6)


# ═══════════════════════════════════════════════════════════════
#  MAIN OVERLAY WINDOW
# ═══════════════════════════════════════════════════════════════

from virtual_keyboard import VirtualKeyboard

class OverlayWindow(QMainWindow):
    """Transparent overlay with camera panel and gesture status."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle('Spatial_Tracer')
        self.setFixedSize(300, 280)

        # Position bottom-right
        self.move(SCREEN_W - 320, SCREEN_H - 350)

        # Frameless + always on top + transparent background
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool
        )
        self.setAttribute(Qt.WA_TranslucentBackground)

        # Tracking thread
        self._tracker_thread = TrackingThread()
        self._tracker_thread.frameReady.connect(self._on_frame)

        # State
        self._camera_minimized = False
        self._keyboard_window = None
        self._keyboard_mode = False
        self._last_kb_tap = 0.0

        # UI
        self._setup_ui()

        # Dragging
        self._drag_pos = None

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Main frame with background
        self._frame = QFrame()
        self._frame.setStyleSheet('''
            QFrame {
                background-color: rgba(5, 5, 8, 230);
                border: 1px solid rgba(124, 106, 255, 0.15);
                border-radius: 14px;
            }
        ''')
        frame_layout = QVBoxLayout(self._frame)
        frame_layout.setContentsMargins(10, 10, 10, 10)
        frame_layout.setSpacing(8)

        # Top bar
        top_bar = QHBoxLayout()
        self._title = QLabel('SPATIAL_TRACER')
        self._title.setStyleSheet('''
            QLabel {
                color: #7c6aff;
                font-family: 'JetBrains Mono';
                font-size: 10px;
                font-weight: bold;
                letter-spacing: 2px;
                background: transparent;
                border: none;
            }
        ''')
        top_bar.addWidget(self._title)
        top_bar.addStretch()

        self._status_badge = QLabel('IDLE')
        self._status_badge.setStyleSheet('''
            QLabel {
                color: #6e6e80;
                font-family: 'JetBrains Mono';
                font-size: 9px;
                font-weight: bold;
                background: rgba(255,255,255,0.03);
                padding: 2px 8px;
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.04);
            }
        ''')
        top_bar.addWidget(self._status_badge)

        _ICON_BTN_STYLE = '''
            QPushButton {
                color: #3c3c4a;
                background: transparent;
                border: none;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover { color: #7c6aff; }
        '''

        # Keyboard toggle button
        btn_keyboard = QPushButton('⌨')
        btn_keyboard.setFixedSize(20, 20)
        btn_keyboard.setToolTip('Toggle Virtual Keyboard')
        btn_keyboard.setStyleSheet(_ICON_BTN_STYLE)
        btn_keyboard.clicked.connect(self._toggle_keyboard)
        top_bar.addWidget(btn_keyboard)

        # Camera minimize button
        self._btn_minimize = QPushButton('─')
        self._btn_minimize.setFixedSize(20, 20)
        self._btn_minimize.setToolTip('Minimize / Restore Camera')
        self._btn_minimize.setStyleSheet(_ICON_BTN_STYLE)
        self._btn_minimize.clicked.connect(self._toggle_camera_minimize)
        top_bar.addWidget(self._btn_minimize)

        btn_close = QPushButton('×')
        btn_close.setFixedSize(20, 20)
        btn_close.setStyleSheet('''
            QPushButton {
                color: #3c3c4a;
                background: transparent;
                border: none;
                font-size: 16px;
                font-weight: bold;
            }
            QPushButton:hover { color: #ef4444; }
        ''')
        btn_close.clicked.connect(self.close)
        top_bar.addWidget(btn_close)
        frame_layout.addLayout(top_bar)

        # Camera panel
        self._camera = CameraPanel()
        frame_layout.addWidget(self._camera)

        # Bottom controls
        bottom = QHBoxLayout()
        self._btn_start = QPushButton('START')
        self._btn_start.setStyleSheet('''
            QPushButton {
                background: #7c6aff;
                color: white;
                font-family: 'JetBrains Mono';
                font-size: 10px;
                font-weight: bold;
                padding: 6px 16px;
                border-radius: 6px;
                border: none;
                letter-spacing: 1px;
            }
            QPushButton:hover { background: #6c5ce7; }
        ''')
        self._btn_start.clicked.connect(self._toggle_tracking)
        bottom.addWidget(self._btn_start)

        self._gesture_label = QLabel('')
        self._gesture_label.setStyleSheet('''
            QLabel {
                color: #22d3ee;
                font-family: 'JetBrains Mono';
                font-size: 11px;
                font-weight: bold;
                background: transparent;
                border: none;
            }
        ''')
        bottom.addWidget(self._gesture_label)
        bottom.addStretch()

        frame_layout.addLayout(bottom)
        layout.addWidget(self._frame)

    def _toggle_tracking(self):
        if self._tracker_thread.isRunning():
            self._tracker_thread.stop()
            self._btn_start.setText('START')
            self._btn_start.setStyleSheet('''
                QPushButton {
                    background: #7c6aff; color: white;
                    font-family: 'JetBrains Mono'; font-size: 10px;
                    font-weight: bold; padding: 6px 16px;
                    border-radius: 6px; border: none; letter-spacing: 1px;
                }
                QPushButton:hover { background: #6c5ce7; }
            ''')
            self._status_badge.setText('IDLE')
            self._status_badge.setStyleSheet('''
                QLabel {
                    color: #6e6e80; font-family: 'JetBrains Mono';
                    font-size: 9px; font-weight: bold;
                    background: rgba(255,255,255,0.03); padding: 2px 8px;
                    border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);
                }
            ''')
        else:
            self._tracker_thread.start()
            self._btn_start.setText('STOP')
            self._btn_start.setStyleSheet('''
                QPushButton {
                    background: #ef4444; color: white;
                    font-family: 'JetBrains Mono'; font-size: 10px;
                    font-weight: bold; padding: 6px 16px;
                    border-radius: 6px; border: none; letter-spacing: 1px;
                }
                QPushButton:hover { background: #dc2626; }
            ''')

    def _on_frame(self, rgb_frame, frame_data, driver_result):
        hands = frame_data.get('hands', [])
        landmarks = hands[0]['landmarks'] if hands else []
        gesture = driver_result.get('gesture', 'IDLE')
        fps = frame_data.get('fps', 0)

        self._camera.update_frame(rgb_frame, landmarks, gesture, fps)

        # Update gesture label
        action = driver_result.get('action', 'none')
        if gesture != 'IDLE':
            self._gesture_label.setText(f'{gesture}')
            # Color based on gesture
            colors = {
                'POINTING': '#34d399', 'PINCH': '#fbbf24',
                'FIST': '#ef4444', 'PEACE': '#7c6aff',
                'THUMBS_UP': '#34d399', 'THUMBS_DOWN': '#f472b6',
                'ROCK': '#fbbf24', 'THREE': '#a393ff',
                'OPEN_PALM': '#22d3ee', 'MIDDLE_FINGER': '#fb923c',
            }
            c = colors.get(gesture, '#6e6e80')
            self._gesture_label.setStyleSheet(f'''
                QLabel {{
                    color: {c}; font-family: 'JetBrains Mono';
                    font-size: 11px; font-weight: bold;
                    background: transparent; border: none;
                }}
            ''')
        else:
            self._gesture_label.setText('')

        # Status badge
        self._status_badge.setText(gesture)
        if gesture == 'POINTING':
            self._status_badge.setStyleSheet('''
                QLabel {
                    color: #34d399; font-family: 'JetBrains Mono';
                    font-size: 9px; font-weight: bold;
                    background: rgba(52,211,153,0.08); padding: 2px 8px;
                    border-radius: 8px; border: 1px solid rgba(52,211,153,0.15);
                }
            ''')
        elif gesture != 'IDLE':
            self._status_badge.setStyleSheet('''
                QLabel {
                    color: #7c6aff; font-family: 'JetBrains Mono';
                    font-size: 9px; font-weight: bold;
                    background: rgba(124,106,255,0.08); padding: 2px 8px;
                    border-radius: 8px; border: 1px solid rgba(124,106,255,0.15);
                }
            ''')
        else:
            self._status_badge.setStyleSheet('''
                QLabel {
                    color: #6e6e80; font-family: 'JetBrains Mono';
                    font-size: 9px; font-weight: bold;
                    background: rgba(255,255,255,0.03); padding: 2px 8px;
                    border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);
                }
            ''')

        # Forward finger position to keyboard if open & in keyboard mode
        if (self._keyboard_mode and self._keyboard_window 
                and self._keyboard_window.isVisible()):
            kb = self._keyboard_window.centralWidget()
            if hands and kb:
                lms = hands[0].get('landmarks', [])
                if len(lms) > 8:
                    # PEACE (index+middle up) → move cursor on keyboard
                    if gesture in ('PEACE', 'POINTING'):
                        # Use index fingertip for position
                        fx = lms[8]['x']
                        fy = lms[8]['y']
                        kb.highlight_at_position(fx, fy)
                    
                    # PINCH → tap the hovered key
                    if gesture == 'PINCH':
                        import time as _time
                        now = _time.time()
                        if now - self._last_kb_tap > 0.5:  # cooldown
                            fx = (lms[4]['x'] + lms[8]['x']) / 2
                            fy = (lms[4]['y'] + lms[8]['y']) / 2
                            tapped = kb.tap_at_position(fx, fy)
                            if tapped:
                                self._last_kb_tap = now
            elif kb:
                kb.clear_cursor()

    # ── Camera minimize ──────────────────────────────────────────
    def _toggle_camera_minimize(self):
        self._camera_minimized = not self._camera_minimized
        if self._camera_minimized:
            self._camera.hide()
            self._btn_minimize.setText('▢')
            self.setFixedSize(300, 100)
        else:
            self._camera.show()
            self._btn_minimize.setText('─')
            self.setFixedSize(300, 280)

    # ── Keyboard toggle ──────────────────────────────────────────
    def _toggle_keyboard(self):
        if self._keyboard_window and self._keyboard_window.isVisible():
            self._keyboard_window.close()
            self._keyboard_window = None
            self._keyboard_mode = False
            self._tracker_thread._driver.paused = False
        else:
            self._keyboard_window = QMainWindow()
            self._keyboard_window.setWindowTitle('Virtual Keyboard')
            self._keyboard_window.setWindowFlags(
                Qt.FramelessWindowHint |
                Qt.WindowStaysOnTopHint |
                Qt.Tool
            )
            self._keyboard_window.setAttribute(Qt.WA_TranslucentBackground)
            kb = VirtualKeyboard()
            self._keyboard_window.setCentralWidget(kb)
            self._keyboard_window.setFixedSize(640, 260)
            # Position above the overlay
            pos = self.pos()
            self._keyboard_window.move(pos.x() - 170, pos.y() - 280)
            self._keyboard_window.show()
            self._keyboard_mode = True
            self._tracker_thread._driver.paused = True

    def _toggle_keyboard_mode(self):
        """Toggle keyboard-only mode (disables mouse movement)."""
        self._keyboard_mode = not self._keyboard_mode
        self._tracker_thread._driver.paused = self._keyboard_mode

    # ── Window dragging ─────────────────────────────────────────
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._drag_pos = event.globalPos() - self.pos()

    def mouseMoveEvent(self, event):
        if self._drag_pos and event.buttons() & Qt.LeftButton:
            self.move(event.globalPos() - self._drag_pos)

    def mouseReleaseEvent(self, event):
        self._drag_pos = None

    def closeEvent(self, event):
        if self._tracker_thread.isRunning():
            self._tracker_thread.stop()
        if self._keyboard_window:
            self._keyboard_window.close()
        event.accept()


# ═══════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════

def run_desktop_app():
    app = QApplication(sys.argv)
    app.setApplicationName('Spatial_Tracer')
    app.setStyle('Fusion')

    # Dark palette
    from PyQt5.QtGui import QPalette
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor(5, 5, 8))
    palette.setColor(QPalette.WindowText, QColor(240, 240, 245))
    palette.setColor(QPalette.Base, QColor(10, 10, 15))
    palette.setColor(QPalette.Text, QColor(240, 240, 245))
    palette.setColor(QPalette.Button, QColor(14, 14, 20))
    palette.setColor(QPalette.ButtonText, QColor(240, 240, 245))
    app.setPalette(palette)

    window = OverlayWindow()
    window.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    run_desktop_app()
