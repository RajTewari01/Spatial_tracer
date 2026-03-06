'''
app.py
>>> Main PyQt5 desktop application window.
    - Camera preview panel with hand skeleton overlay
    - Virtual keyboard with gesture-driven input
    - Toolbar for start/stop and settings
    - Wires everything together: camera → gesture → keyboard → keystroke
'''

import sys
import subprocess
import threading
import time
from pathlib import Path

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QToolBar, QAction, QLabel, QTextEdit,
    QStatusBar, QSizePolicy, QFrame
)
from PyQt5.QtCore import Qt, QSize, QTimer
from PyQt5.QtGui import QFont, QIcon, QColor

_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from api.input_controller import InputController

# Import sibling modules
from virtual_keyboard import VirtualKeyboard
from camera_widget import CameraWidget


class GestureLog(QFrame):
    """A small panel showing recent gesture events and typed characters."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        self._log_lines = []

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)

        title = QLabel("📝 Output")
        title.setFont(QFont("Segoe UI", 10, QFont.Bold))
        title.setStyleSheet("color: #c9d1d9;")
        layout.addWidget(title)

        self._text_edit = QTextEdit()
        self._text_edit.setReadOnly(True)
        self._text_edit.setFont(QFont("Consolas", 10))
        self._text_edit.setStyleSheet("""
            QTextEdit {
                background-color: #161b22;
                color: #c9d1d9;
                border: 1px solid #21262d;
                border-radius: 8px;
                padding: 8px;
            }
        """)
        layout.addWidget(self._text_edit)

        self.setStyleSheet("""
            QFrame {
                background-color: #0d1117;
                border-radius: 12px;
                border: 1px solid #21262d;
            }
        """)

    def log_key(self, label: str):
        """Log a key press."""
        display = label if len(label) == 1 else f"[{label}]"
        self._log_lines.append(display)
        if len(self._log_lines) > 100:
            self._log_lines = self._log_lines[-50:]
        self._text_edit.setPlainText("".join(self._log_lines))
        # Auto-scroll
        cursor = self._text_edit.textCursor()
        cursor.movePosition(cursor.End)
        self._text_edit.setTextCursor(cursor)

    def log_gesture(self, gesture: str):
        """Log a gesture event."""
        self._log_lines.append(f"\n⚡ {gesture}\n")
        self._text_edit.setPlainText("".join(self._log_lines))


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self._input_controller = InputController()
        self._server_process = None
        self._tracking_active = False
        self._setup_ui()
        self._setup_toolbar()
        self._setup_statusbar()
        self._connect_signals()

    def _setup_ui(self):
        self.setWindowTitle("Vision Tracking Engine — Air Gesture Keyboard")
        self.setMinimumSize(1100, 700)
        self.resize(1280, 800)

        # Dark theme
        self.setStyleSheet("""
            QMainWindow {
                background-color: #0d1117;
            }
            QToolBar {
                background-color: #161b22;
                border-bottom: 1px solid #21262d;
                padding: 4px 8px;
                spacing: 8px;
            }
            QToolBar QToolButton {
                background-color: transparent;
                color: #c9d1d9;
                border: 1px solid #30363d;
                border-radius: 6px;
                padding: 6px 12px;
                font-family: 'Segoe UI';
                font-size: 10pt;
            }
            QToolBar QToolButton:hover {
                background-color: #21262d;
                border-color: #6c63ff;
            }
            QToolBar QToolButton:pressed {
                background-color: #6c63ff;
            }
            QStatusBar {
                background-color: #161b22;
                color: #8b949e;
                border-top: 1px solid #21262d;
                font-family: 'Segoe UI';
                font-size: 9pt;
            }
        """)

        # ── Central widget ──────────────────────────────────────
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setContentsMargins(12, 12, 12, 12)
        main_layout.setSpacing(12)

        # ── Top: camera + gesture log ───────────────────────────
        top_splitter = QSplitter(Qt.Horizontal)

        self._camera_widget = CameraWidget()
        self._camera_widget.setMinimumWidth(400)
        top_splitter.addWidget(self._camera_widget)

        self._gesture_log = GestureLog()
        self._gesture_log.setMinimumWidth(250)
        self._gesture_log.setMaximumWidth(400)
        top_splitter.addWidget(self._gesture_log)

        top_splitter.setStretchFactor(0, 3)
        top_splitter.setStretchFactor(1, 1)
        main_layout.addWidget(top_splitter, stretch=2)

        # ── Bottom: virtual keyboard ────────────────────────────
        self._keyboard = VirtualKeyboard()
        main_layout.addWidget(self._keyboard, stretch=3)

    def _setup_toolbar(self):
        toolbar = QToolBar("Main Toolbar")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(20, 20))
        self.addToolBar(toolbar)

        # Title label
        title = QLabel("  🖐️ Vision Tracker  ")
        title.setFont(QFont("Segoe UI", 12, QFont.Bold))
        title.setStyleSheet("color: #6c63ff; border: none;")
        toolbar.addWidget(title)

        toolbar.addSeparator()

        # Start server
        self._start_action = QAction("▶ Start Server", self)
        self._start_action.triggered.connect(self._start_server)
        toolbar.addAction(self._start_action)

        # Stop server
        self._stop_action = QAction("⏹ Stop", self)
        self._stop_action.triggered.connect(self._stop_server)
        self._stop_action.setEnabled(False)
        toolbar.addAction(self._stop_action)

        toolbar.addSeparator()

        # Connect camera
        self._connect_action = QAction("📡 Connect Camera", self)
        self._connect_action.triggered.connect(self._toggle_camera)
        toolbar.addAction(self._connect_action)

    def _setup_statusbar(self):
        self._status_label = QLabel("Ready")
        self.statusBar().addPermanentWidget(self._status_label)

    def _connect_signals(self):
        # Camera finger position → keyboard highlight
        self._camera_widget.fingerPosition.connect(self._on_finger_position)

        # Camera gesture → handle gesture
        self._camera_widget.gestureDetected.connect(self._on_gesture)

        # Keyboard key tap → input controller
        self._keyboard.keyTapped.connect(self._on_key_tapped)

    def _on_finger_position(self, x: float, y: float):
        """Highlight the key under the finger."""
        self._keyboard.highlight_at_position(x, y)

    def _on_gesture(self, gesture: str, x: float, y: float):
        """Handle a detected gesture."""
        self._gesture_log.log_gesture(gesture)

        if gesture == "tap":
            # Tap the key at the finger position
            label = self._keyboard.tap_at_position(x, y)
            if label:
                self._input_controller.press_key(label)
                self._gesture_log.log_key(label)

    def _on_key_tapped(self, label: str):
        """Handle direct keyboard clicks."""
        self._input_controller.press_key(label)
        self._gesture_log.log_key(label)

    def _start_server(self):
        """Start the FastAPI server in a subprocess."""
        if self._server_process and self._server_process.poll() is None:
            return

        self._server_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "api.fastapi_main:app",
             "--host", "0.0.0.0", "--port", "8765"],
            cwd=str(_ROOT),
        )
        self._start_action.setEnabled(False)
        self._stop_action.setEnabled(True)
        self._status_label.setText("Server running on localhost:8765")

        # Auto-connect camera after short delay
        QTimer.singleShot(1500, self._camera_widget.start_connection)

    def _stop_server(self):
        """Stop the server subprocess."""
        self._camera_widget.stop_connection()
        if self._server_process:
            self._server_process.terminate()
            self._server_process = None
        self._start_action.setEnabled(True)
        self._stop_action.setEnabled(False)
        self._status_label.setText("Server stopped")

    def _toggle_camera(self):
        """Toggle camera WebSocket connection."""
        if self._camera_widget._connected:
            self._camera_widget.stop_connection()
            self._connect_action.setText("📡 Connect Camera")
        else:
            self._camera_widget.start_connection()
            self._connect_action.setText("📡 Disconnect")

    def closeEvent(self, event):
        """Cleanup on window close."""
        self._camera_widget.stop_connection()
        self._stop_server()
        event.accept()


def run_desktop_app():
    """Launch the desktop application."""
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    # Set dark palette
    palette = app.palette()
    palette.setColor(palette.Window, QColor(13, 17, 23))
    palette.setColor(palette.WindowText, QColor(201, 209, 217))
    palette.setColor(palette.Base, QColor(22, 27, 34))
    palette.setColor(palette.AlternateBase, QColor(13, 17, 23))
    palette.setColor(palette.ToolTipBase, QColor(22, 27, 34))
    palette.setColor(palette.ToolTipText, QColor(201, 209, 217))
    palette.setColor(palette.Text, QColor(201, 209, 217))
    palette.setColor(palette.Button, QColor(33, 38, 45))
    palette.setColor(palette.ButtonText, QColor(201, 209, 217))
    palette.setColor(palette.Highlight, QColor(108, 99, 255))
    palette.setColor(palette.HighlightedText, QColor(255, 255, 255))
    app.setPalette(palette)

    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    run_desktop_app()
