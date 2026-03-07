'''
virtual_keyboard.py
>>> PyQt5 virtual QWERTY keyboard widget.
    - Premium glassmorphic design
        - Gesture-driven key highlighting and activation
    - Finger cursor overlay for visual feedback
    - Emits keyTapped signal when a key is hit
'''

from PyQt5.QtWidgets import (
    QWidget, QGridLayout, QPushButton, QSizePolicy, QVBoxLayout
)
from PyQt5.QtCore import pyqtSignal, Qt, QSize, QPoint, QTimer, QRectF
from PyQt5.QtGui import (
    QFont, QColor, QPalette, QPainter, QPen, QBrush,
    QRadialGradient, QLinearGradient, QPainterPath
)


# ── Key layout definition ───────────────────────────────────────
KEYBOARD_ROWS = [
    # Row 0: number row
    [
        ("~", 1), ("1", 1), ("2", 1), ("3", 1), ("4", 1), ("5", 1),
        ("6", 1), ("7", 1), ("8", 1), ("9", 1), ("0", 1),
        ("-", 1), ("=", 1), ("BACK", 1.5), ("DEL", 1.5),
    ],
    # Row 1: QWERTY
    [
        ("TAB", 1.5), ("Q", 1), ("W", 1), ("E", 1), ("R", 1), ("T", 1),
        ("Y", 1), ("U", 1), ("I", 1), ("O", 1), ("P", 1),
        ("[", 1), ("]", 1), ("\\", 1.5),
    ],
    # Row 2: ASDF
    [
        ("CAPS", 1.8), ("A", 1), ("S", 1), ("D", 1), ("F", 1), ("G", 1),
        ("H", 1), ("J", 1), ("K", 1), ("L", 1), (";", 1),
        ("'", 1), ("ENTER", 2.2),
    ],
    # Row 3: ZXCV
    [
        ("SHIFT", 2.4), ("Z", 1), ("X", 1), ("C", 1), ("V", 1), ("B", 1),
        ("N", 1), ("M", 1), (",", 1), (".", 1), ("/", 1),
        ("SHFT", 1.6), ("^", 1),
    ],
    # Row 4: bottom row + arrows
    [
        ("CTRL", 1.4), ("WIN", 1.2), ("ALT", 1.2), ("SPACE", 5),
        ("ALT", 1.2), ("CTRL", 1.2), ("<", 1.3), ("v", 1.3), (">", 1.3),
    ],
]


class KeyButton(QPushButton):
    """A single key on the virtual keyboard."""

    def __init__(self, label: str, parent=None):
        super().__init__(label, parent)
        self.key_label = label
        self._is_modifier = label in ("SHIFT", "SHFT", "CTRL", "ALT", "WIN", "CAPS")
        self._is_active = False
        self._is_highlighted = False
        self._default_style = ""
        self._setup_style()

    def _setup_style(self):
        base_font_size = 10 if len(self.key_label) <= 2 else 8
        mod_bg = "rgba(60,40,120,0.5)" if self._is_modifier else "rgba(30,28,50,0.7)"
        self._default_style = f"""
            QPushButton {{
                background-color: {mod_bg};
                color: rgba(220,215,245,0.9);
                border: 1px solid rgba(124,106,255,0.12);
                border-bottom: 2px solid rgba(0,0,0,0.4);
                border-radius: 5px;
                padding: 4px 2px;
                font-family: 'JetBrains Mono', 'Segoe UI', monospace;
                font-size: {base_font_size}pt;
                font-weight: 500;
                letter-spacing: 0.5px;
            }}
            QPushButton:hover {{
                background-color: rgba(124,106,255,0.18);
                border-color: rgba(124,106,255,0.35);
                color: white;
            }}
            QPushButton:pressed {{
                background-color: rgba(124,106,255,0.55);
                color: white;
                border-bottom: 1px solid rgba(0,0,0,0.2);
            }}
        """
        self.setStyleSheet(self._default_style)
        self.setMinimumHeight(36)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.setCursor(Qt.PointingHandCursor)

    def set_highlighted(self, highlighted: bool):
        """Highlight when a finger is hovering over this key."""
        if highlighted == self._is_highlighted:
            return
        self._is_highlighted = highlighted
        sz = 10 if len(self.key_label) <= 2 else 8
        if highlighted:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(124,106,255,0.45);
                    color: white;
                    border: 1px solid rgba(139,131,255,0.6);
                    border-bottom: 2px solid rgba(124,106,255,0.3);
                    border-radius: 5px;
                    padding: 4px 2px;
                    font-family: 'JetBrains Mono', 'Segoe UI', monospace;
                    font-size: {sz}pt;
                    font-weight: 700;
                }}
            """)
        else:
            self.setStyleSheet(self._default_style)

    def set_active(self, active: bool):
        """Toggle modifier active state."""
        self._is_active = active
        sz = 10 if len(self.key_label) <= 2 else 8
        if active:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: rgba(255,107,107,0.5);
                    color: white;
                    border: 1px solid rgba(255,135,135,0.5);
                    border-bottom: 2px solid rgba(200,50,50,0.3);
                    border-radius: 5px;
                    padding: 4px 2px;
                    font-family: 'JetBrains Mono', 'Segoe UI', monospace;
                    font-size: {sz}pt;
                    font-weight: 700;
                }}
            """)
        else:
            self.setStyleSheet(self._default_style)

    def flash_pressed(self):
        """Brief flash effect when key is tapped by gesture."""
        sz = 10 if len(self.key_label) <= 2 else 8
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: rgba(52,211,153,0.6);
                color: #0a0a14;
                border: 1px solid rgba(105,240,174,0.5);
                border-bottom: 2px solid rgba(30,150,100,0.3);
                border-radius: 5px;
                padding: 4px 2px;
                font-family: 'JetBrains Mono', 'Segoe UI', monospace;
                font-size: {sz}pt;
                font-weight: 700;
            }}
        """)
        QTimer.singleShot(200, lambda: self.setStyleSheet(self._default_style))


class VirtualKeyboard(QWidget):
    """
    Full QWERTY virtual keyboard widget with finger cursor overlay.

    Signals:
        keyTapped(str) — emitted when a key is activated (by click or gesture).
    """

    keyTapped = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._buttons: dict[str, list[KeyButton]] = {}
        self._all_buttons: list[KeyButton] = []
        self._cursor_pos = None  # (norm_x, norm_y) for finger cursor
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(3)
        layout.setContentsMargins(10, 10, 10, 10)

        for row_data in KEYBOARD_ROWS:
            row_layout = QGridLayout()
            row_layout.setSpacing(3)
            col = 0
            for label, span in row_data:
                btn = KeyButton(label)
                btn.clicked.connect(lambda checked, l=label: self._on_key_clicked(l))
                # Span is a float multiplier for width
                col_span = max(1, int(span * 2))
                row_layout.addWidget(btn, 0, col, 1, col_span)
                col += col_span

                # Track buttons by label
                if label not in self._buttons:
                    self._buttons[label] = []
                self._buttons[label].append(btn)
                self._all_buttons.append(btn)

            layout.addLayout(row_layout)

        self.setStyleSheet("""
            QWidget {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(12,10,25,240),
                    stop:1 rgba(8,6,18,250));
                border-radius: 12px;
                border: 1px solid rgba(124,106,255,0.08);
            }
        """)

    def _on_key_clicked(self, label: str):
        """Handle direct click on a key button."""
        self._flash_key(label)
        self.keyTapped.emit(label)

    def _flash_key(self, label: str):
        """Flash visual feedback on the key."""
        buttons = self._buttons.get(label, [])
        for btn in buttons:
            btn.flash_pressed()

    def set_cursor(self, norm_x: float, norm_y: float):
        """Set the finger cursor position (0-1 normalized) and repaint."""
        self._cursor_pos = (norm_x, norm_y)
        self.update()

    def clear_cursor(self):
        """Remove the finger cursor."""
        self._cursor_pos = None
        self.update()

    def paintEvent(self, event):
        """Draw the finger cursor overlay on top of keys."""
        super().paintEvent(event)
        if self._cursor_pos is None:
            return

        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)

        cx = int(self._cursor_pos[0] * self.width())
        cy = int(self._cursor_pos[1] * self.height())

        # Outer glow
        grad = QRadialGradient(cx, cy, 18)
        grad.setColorAt(0, QColor(124, 106, 255, 100))
        grad.setColorAt(0.5, QColor(124, 106, 255, 30))
        grad.setColorAt(1, QColor(124, 106, 255, 0))
        p.setBrush(QBrush(grad))
        p.setPen(Qt.NoPen)
        p.drawEllipse(cx - 18, cy - 18, 36, 36)

        # Inner dot
        p.setBrush(QColor(52, 211, 153, 220))
        p.setPen(QPen(QColor(255, 255, 255, 150), 1.5))
        p.drawEllipse(cx - 5, cy - 5, 10, 10)

        p.end()

    def highlight_at_position(self, norm_x: float, norm_y: float) -> str | None:
        """
        Highlight the key under the given normalized position (0-1).
        Returns the key label if a key is found, else None.
        """
        self.set_cursor(norm_x, norm_y)

        # Clear all highlights
        for btn in self._all_buttons:
            btn.set_highlighted(False)

        # Convert normalized position to widget coordinates
        px = int(norm_x * self.width())
        py = int(norm_y * self.height())
        point = QPoint(px, py)

        # Find the button at this position
        for btn in self._all_buttons:
            btn_rect = btn.geometry()
            parent = btn.parentWidget()
            if parent:
                mapped = parent.mapTo(self, btn_rect.topLeft())
                btn_rect.moveTopLeft(mapped)
            if btn_rect.contains(point):
                btn.set_highlighted(True)
                return btn.key_label

        return None

    def tap_at_position(self, norm_x: float, norm_y: float) -> str | None:
        """
        Activate (tap) the key under the given normalized position.
        Returns the key label if a key was tapped.
        """
        label = self.highlight_at_position(norm_x, norm_y)
        if label:
            self._flash_key(label)
            self.keyTapped.emit(label)
        return label

    def get_key_at_position(self, norm_x: float, norm_y: float) -> str | None:
        """Check which key is under the position without activating it."""
        px = int(norm_x * self.width())
        py = int(norm_y * self.height())
        point = QPoint(px, py)

        for btn in self._all_buttons:
            btn_rect = btn.geometry()
            parent = btn.parentWidget()
            if parent:
                mapped = parent.mapTo(self, btn_rect.topLeft())
                btn_rect.moveTopLeft(mapped)
            if btn_rect.contains(point):
                return btn.key_label
        return None
