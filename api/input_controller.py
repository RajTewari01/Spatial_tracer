'''
input_controller.py
>>> Translates gesture events into real OS keystrokes via pynput.
'''

from pynput.keyboard import Controller, Key
from typing import Optional


# Map virtual keyboard labels to pynput keys
_SPECIAL_KEYS = {
    "ENTER":  Key.enter,
    "SPACE":  Key.space,
    "BACK":   Key.backspace,
    "TAB":    Key.tab,
    "CAPS":   Key.caps_lock,
    "SHIFT":  Key.shift,
    "SHFT":   Key.shift_r,
    "CTRL":   Key.ctrl,
    "ALT":    Key.alt,
    "WIN":    Key.cmd,
    "ESC":    Key.esc,
    "DELETE": Key.delete,
    "^":      Key.up,
    "v":      Key.down,
    "<":      Key.left,
    ">":      Key.right,
}


class InputController:
    """
    Converts virtual key labels into real OS keypresses using pynput.
    
    Usage:
        ctrl = InputController()
        ctrl.press_key("A")      # types 'a'
        ctrl.press_key("ENTER")  # presses Enter
        ctrl.press_key("SPACE")  # presses Space
    """

    def __init__(self):
        self._keyboard = Controller()
        self._shift_active = False
        self._ctrl_active = False
        self._alt_active = False
        self._caps_active = False

    @property
    def shift_active(self) -> bool:
        return self._shift_active

    @property
    def caps_active(self) -> bool:
        return self._caps_active

    def press_key(self, label: str) -> bool:
        """
        Press a key corresponding to the given virtual keyboard label.
        
        Returns True if the key was successfully pressed.
        """
        if not label:
            return False

        # ── Modifier toggles ────────────────────────────────────
        if label in ("SHIFT", "SHFT"):
            self._shift_active = not self._shift_active
            return True

        if label == "CAPS":
            self._caps_active = not self._caps_active
            special = _SPECIAL_KEYS[label]
            self._keyboard.press(special)
            self._keyboard.release(special)
            return True

        if label == "CTRL":
            self._ctrl_active = not self._ctrl_active
            return True

        if label == "ALT":
            self._alt_active = not self._alt_active
            return True

        # ── Special keys ────────────────────────────────────────
        special = _SPECIAL_KEYS.get(label)
        if special:
            self._tap_with_modifiers(special)
            self._reset_modifiers()
            return True

        # ── Regular characters ──────────────────────────────────
        char = label.lower()
        if len(char) == 1:
            if self._shift_active or self._caps_active:
                char = char.upper()
            self._tap_with_modifiers(char)
            self._reset_modifiers()
            return True

        return False

    def _tap_with_modifiers(self, key) -> None:
        """Press key with any active modifiers, then release all."""
        held = []
        if self._ctrl_active:
            self._keyboard.press(Key.ctrl)
            held.append(Key.ctrl)
        if self._alt_active:
            self._keyboard.press(Key.alt)
            held.append(Key.alt)
        if self._shift_active and not isinstance(key, str):
            self._keyboard.press(Key.shift)
            held.append(Key.shift)

        if isinstance(key, str):
            self._keyboard.press(key)
            self._keyboard.release(key)
        else:
            self._keyboard.press(key)
            self._keyboard.release(key)

        for k in reversed(held):
            self._keyboard.release(k)

    def _reset_modifiers(self) -> None:
        """Reset one-shot modifiers (shift resets, caps stays)."""
        self._shift_active = False
        self._ctrl_active = False
        self._alt_active = False

    def type_string(self, text: str) -> None:
        """Type a full string character by character."""
        self._keyboard.type(text)
