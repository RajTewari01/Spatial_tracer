'''
camera_widget.py
>>> PyQt5 widget for camera preview + hand overlay.
    - Connects to FastAPI WebSocket for hand data
    - Renders finger position cursors
    - Emits fingerPosition signals for keyboard hit-testing
'''

import json
import asyncio
import threading

from PyQt5.QtWidgets import QWidget, QLabel, QVBoxLayout, QHBoxLayout, QSizePolicy
from PyQt5.QtCore import (
    pyqtSignal, Qt, QTimer, QThread, QPoint, QRectF
)
from PyQt5.QtGui import (
    QPainter, QColor, QPen, QBrush, QRadialGradient,
    QFont, QPainterPath, QLinearGradient
)

try:
    import websocket as ws_lib
    _HAS_WEBSOCKET = True
except ImportError:
    _HAS_WEBSOCKET = False


class WebSocketWorker(QThread):
    """Background thread that reads hand data from the FastAPI WebSocket."""
    
    frameReceived = pyqtSignal(dict)
    connectionChanged = pyqtSignal(bool)

    def __init__(self, url: str = "ws://localhost:8765/ws/hand-data"):
        super().__init__()
        self._url = url
        self._running = False
        self._ws = None

    def run(self):
        self._running = True
        
        while self._running:
            try:
                import websockets.sync.client as sync_client
                with sync_client.connect(self._url) as ws:
                    self.connectionChanged.emit(True)
                    while self._running:
                        try:
                            msg = ws.recv(timeout=1.0)
                            data = json.loads(msg)
                            self.frameReceived.emit(data)
                        except TimeoutError:
                            continue
                        except Exception:
                            break
            except Exception:
                self.connectionChanged.emit(False)
                if self._running:
                    import time
                    time.sleep(2)  # Retry after 2 seconds

        self.connectionChanged.emit(False)

    def stop(self):
        self._running = False
        self.quit()
        self.wait(3000)


class CameraWidget(QWidget):
    """
    Widget that displays hand tracking data with finger cursors.
    
    Signals:
        fingerPosition(float, float) — normalized (x, y) of the index fingertip
        gestureDetected(str, float, float) — gesture name, x, y
    """

    fingerPosition = pyqtSignal(float, float)
    gestureDetected = pyqtSignal(str, float, float)

    def __init__(self, parent=None, ws_url: str = "ws://localhost:8765/ws/hand-data"):
        super().__init__(parent)
        self._ws_url = ws_url
        self._connected = False
        self._current_frame = None
        self._finger_positions = []  # List of (x, y, label) for each fingertip
        self._gesture_text = ""
        self._gesture_timer = QTimer()
        self._gesture_timer.timeout.connect(self._clear_gesture)
        self._fps = 0.0

        self._worker: WebSocketWorker | None = None
        self._setup_ui()

    def _setup_ui(self):
        self.setMinimumSize(300, 200)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.setStyleSheet("""
            QWidget {
                background-color: #0d1117;
                border-radius: 12px;
                border: 1px solid #21262d;
            }
        """)

    def start_connection(self):
        """Start the WebSocket connection to the server."""
        if self._worker and self._worker.isRunning():
            return
        self._worker = WebSocketWorker(self._ws_url)
        self._worker.frameReceived.connect(self._on_frame)
        self._worker.connectionChanged.connect(self._on_connection_changed)
        self._worker.start()

    def stop_connection(self):
        """Stop the WebSocket connection."""
        if self._worker:
            self._worker.stop()
            self._worker = None

    def _on_connection_changed(self, connected: bool):
        self._connected = connected
        self.update()

    def _on_frame(self, data: dict):
        self._current_frame = data
        self._fps = data.get("fps", 0)

        # Extract finger positions
        self._finger_positions.clear()
        for hand in data.get("hands", []):
            fingertips = hand.get("fingertips", [])
            handedness = hand.get("handedness", "")
            for tip in fingertips:
                self._finger_positions.append((
                    tip["x"], tip["y"],
                    f"{handedness[0]}{tip['id']}" if handedness else str(tip["id"])
                ))
            
            # Emit index fingertip position for keyboard hit-testing
            for tip in fingertips:
                if tip["id"] == 8:  # INDEX_TIP
                    self.fingerPosition.emit(tip["x"], tip["y"])

        # Handle gestures
        for gesture in data.get("gestures", []):
            name = gesture.get("gesture", "")
            pos = gesture.get("position", {})
            self._gesture_text = name.upper()
            self._gesture_timer.start(1500)
            self.gestureDetected.emit(
                name,
                pos.get("x", 0.5),
                pos.get("y", 0.5)
            )

        self.update()

    def _clear_gesture(self):
        self._gesture_text = ""
        self._gesture_timer.stop()
        self.update()

    def paintEvent(self, event):
        """Custom paint: finger cursors, connection status, gesture overlay."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        w, h = self.width(), self.height()

        # ── Background gradient ─────────────────────────────────
        grad = QLinearGradient(0, 0, 0, h)
        grad.setColorAt(0, QColor(13, 17, 23))
        grad.setColorAt(1, QColor(22, 27, 34))
        painter.fillRect(self.rect(), grad)

        # ── Connection status ───────────────────────────────────
        status_color = QColor(0, 230, 118) if self._connected else QColor(255, 82, 82)
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(status_color))
        painter.drawEllipse(w - 24, 12, 10, 10)

        painter.setPen(QPen(QColor(200, 200, 200), 1))
        painter.setFont(QFont("Segoe UI", 9))
        status_text = f"Connected • {self._fps:.0f} FPS" if self._connected else "Disconnected"
        painter.drawText(w - 180, 22, status_text)

        if not self._connected:
            painter.setPen(QPen(QColor(139, 148, 158), 1))
            painter.setFont(QFont("Segoe UI", 12))
            painter.drawText(
                self.rect(), Qt.AlignCenter,
                "Waiting for connection...\nStart the server with: python main.py server"
            )
            painter.end()
            return

        # ── Draw hand skeleton lines ────────────────────────────
        if self._current_frame:
            for hand in self._current_frame.get("hands", []):
                landmarks = hand.get("landmarks", [])
                if len(landmarks) >= 21:
                    self._draw_hand_skeleton(painter, landmarks, w, h)

        # ── Draw finger cursors ─────────────────────────────────
        for fx, fy, label in self._finger_positions:
            px, py = int(fx * w), int(fy * h)

            # Glow effect
            glow_grad = QRadialGradient(px, py, 25)
            glow_grad.setColorAt(0, QColor(108, 99, 255, 120))
            glow_grad.setColorAt(1, QColor(108, 99, 255, 0))
            painter.setPen(Qt.NoPen)
            painter.setBrush(QBrush(glow_grad))
            painter.drawEllipse(QPoint(px, py), 25, 25)

            # Dot
            painter.setBrush(QBrush(QColor(108, 99, 255)))
            painter.drawEllipse(QPoint(px, py), 6, 6)

            # Label
            painter.setPen(QPen(QColor(200, 200, 200), 1))
            painter.setFont(QFont("Segoe UI", 7))
            painter.drawText(px + 10, py - 10, label)

        # ── Gesture overlay ─────────────────────────────────────
        if self._gesture_text:
            painter.setPen(QPen(QColor(0, 230, 118), 2))
            painter.setFont(QFont("Segoe UI", 20, QFont.Bold))
            painter.drawText(
                self.rect(), Qt.AlignBottom | Qt.AlignHCenter,
                f"✋ {self._gesture_text}"
            )

        painter.end()

    def _draw_hand_skeleton(self, painter: QPainter, landmarks: list, w: int, h: int):
        """Draw lines connecting hand landmarks in skeleton pattern."""
        connections = [
            # Thumb
            (0, 1), (1, 2), (2, 3), (3, 4),
            # Index
            (0, 5), (5, 6), (6, 7), (7, 8),
            # Middle
            (0, 9), (9, 10), (10, 11), (11, 12),
            # Ring
            (0, 13), (13, 14), (14, 15), (15, 16),
            # Pinky
            (0, 17), (17, 18), (18, 19), (19, 20),
            # Palm
            (5, 9), (9, 13), (13, 17),
        ]

        lm_map = {lm["id"]: lm for lm in landmarks}

        # Draw connections
        painter.setPen(QPen(QColor(58, 166, 255, 150), 2))
        for a, b in connections:
            if a in lm_map and b in lm_map:
                ax, ay = int(lm_map[a]["x"] * w), int(lm_map[a]["y"] * h)
                bx, by = int(lm_map[b]["x"] * w), int(lm_map[b]["y"] * h)
                painter.drawLine(ax, ay, bx, by)

        # Draw joints
        painter.setPen(Qt.NoPen)
        painter.setBrush(QBrush(QColor(58, 166, 255, 200)))
        for lm in landmarks:
            px, py = int(lm["x"] * w), int(lm["y"] * h)
            painter.drawEllipse(QPoint(px, py), 3, 3)
