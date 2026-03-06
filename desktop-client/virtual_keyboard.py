'''
virtual_keyboard.py
>>> PyQt5 virtual QWERTY keyboard widget.
    - Full keyboard layout with modifier support
    - Gesture-driven key highlighting and activation
    - Emits keyTapped signal when a key is hit
'''

from PyQt5.QtWidgets import (
    QWidget, QGridLayout, QPushButton, QSizePolicy, QVBoxLayout
)
from PyQt5.QtCore import pyqtSignal, Qt, QSize, QPoint, QPropertyAnimation, QEasingCurve
from PyQt5.QtGui import QFont, QColor, QPalette


# ── Key layout definition ───────────────────────────────────────
KEYBOARD_ROWS = [
    # Row 0: number row
    [
        ("~", 1), ("1", 1), ("2", 1), ("3", 1), ("4", 1), ("5", 1),
        ("6", 1), ("7", 1), ("8", 1), ("9", 1), ("0", 1),
        ("-", 1), ("=", 1), ("BACK", 2),
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
    # Row 4: bottom row
    [
        ("CTRL", 1.4), ("WIN", 1.2), ("ALT", 1.2), ("SPACE", 6),
        ("ALT", 1.2), ("CTRL", 1.2), ("<", 1), ("v", 1), (">", 1),
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
        base_font_size = 11 if len(self.key_label) <= 2 else 9
        self._default_style = f"""
            QPushButton {{
                background-color: #2a2a3e;
                color: #e0e0e0;
                border: 1px solid #3a3a5c;
                border-radius: 6px;
                padding: 8px 4px;
                font-family: 'Segoe UI', 'Inter', sans-serif;
                font-size: {base_font_size}pt;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: #3a3a5c;
                border-color: #6c63ff;
            }}
            QPushButton:pressed {{
                background-color: #6c63ff;
                color: white;
            }}
        """
        self.setStyleSheet(self._default_style)
        self.setMinimumHeight(44)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.setCursor(Qt.PointingHandCursor)

    def set_highlighted(self, highlighted: bool):
        """Highlight when a finger is hovering over this key."""
        if highlighted == self._is_highlighted:
            return
        self._is_highlighted = highlighted
        if highlighted:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: #6c63ff;
                    color: white;
                    border: 2px solid #8b83ff;
                    border-radius: 6px;
                    padding: 8px 4px;
                    font-family: 'Segoe UI', 'Inter', sans-serif;
                    font-size: {11 if len(self.key_label) <= 2 else 9}pt;
                    font-weight: 700;
                }}
            """)
        else:
            self.setStyleSheet(self._default_style)

    def set_active(self, active: bool):
        """Toggle modifier active state."""
        self._is_active = active
        if active:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: #ff6b6b;
                    color: white;
                    border: 2px solid #ff8787;
                    border-radius: 6px;
                    padding: 8px 4px;
                    font-family: 'Segoe UI', 'Inter', sans-serif;
                    font-size: {11 if len(self.key_label) <= 2 else 9}pt;
                    font-weight: 700;
                }}
            """)
        else:
            self.setStyleSheet(self._default_style)

    def flash_pressed(self):
        """Brief flash effect when key is tapped by gesture."""
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: #00e676;
                color: #1a1a2e;
                border: 2px solid #69f0ae;
                border-radius: 6px;
                padding: 8px 4px;
                font-family: 'Segoe UI', 'Inter', sans-serif;
                font-size: {11 if len(self.key_label) <= 2 else 9}pt;
                font-weight: 700;
            }}
        """)
        from PyQt5.QtCore import QTimer
        QTimer.singleShot(200, lambda: self.setStyleSheet(self._default_style))


class VirtualKeyboard(QWidget):
    """
    Full QWERTY virtual keyboard widget.
    
    Signals:
        keyTapped(str) — emitted when a key is activated (by click or gesture).
    """

    keyTapped = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._buttons: dict[str, list[KeyButton]] = {}
        self._all_buttons: list[KeyButton] = []
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(4)
        layout.setContentsMargins(8, 8, 8, 8)

        for row_data in KEYBOARD_ROWS:
            row_layout = QGridLayout()
            row_layout.setSpacing(4)
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
                background-color: #1a1a2e;
                border-radius: 12px;
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

    def highlight_at_position(self, norm_x: float, norm_y: float) -> str | None:
        """
        Highlight the key under the given normalized position (0-1).
        Returns the key label if a key is found, else None.
        """
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
            # Map to parent coordinates
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
