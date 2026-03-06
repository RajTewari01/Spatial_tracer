'''
air_input_driver.py
>>> Translates hand landmarks + gestures into real OS mouse/keyboard actions.

Gesture mapping:
    Pointing (index up)   → Move mouse cursor
    Pinch (thumb+index)   → Left click / drag
    Fist                  → Right click
    Peace (index+middle)  → Double click
    Swipe up/down         → Scroll
    Thumbs up             → Enter
    Thumbs down           → Backspace
    Three fingers         → Tab
    Rock                  → Escape
    Open palm             → Release / idle
'''

from pynput.mouse import Controller as MouseCtrl, Button
from pynput.keyboard import Controller as KbdCtrl, Key
import time
import math
from typing import Optional, Dict, List, Any, Tuple

# ── Landmark IDs ────────────────────────────────────────────────
WRIST = 0
THUMB_TIP = 4; THUMB_IP = 3; THUMB_MCP = 2
INDEX_TIP = 8; INDEX_PIP = 6; INDEX_MCP = 5
MIDDLE_TIP = 12; MIDDLE_PIP = 10; MIDDLE_MCP = 9
RING_TIP = 16; RING_PIP = 14; RING_MCP = 13
PINKY_TIP = 20; PINKY_PIP = 18; PINKY_MCP = 17

TIP = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
PIP = [THUMB_IP, INDEX_PIP, MIDDLE_PIP, RING_PIP, PINKY_PIP]
MCP = [THUMB_MCP, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]


class AirInputDriver:
    """
    Drives the OS mouse + keyboard from hand landmark data.
    Call `process_frame(frame_data)` each frame.
    """

    def __init__(
        self,
        screen_w: int = 1920,
        screen_h: int = 1080,
        smoothing: float = 0.35,
        margin: float = 0.08,
        click_cooldown: float = 0.4,
        scroll_cooldown: float = 0.15,
        key_cooldown: float = 0.5,
    ):
        self._mouse = MouseCtrl()
        self._kbd = KbdCtrl()

        self.screen_w = screen_w
        self.screen_h = screen_h
        self._smoothing = smoothing    # 0 = no smoothing, 1 = max
        self._margin = margin          # dead zone at screen edges

        # Smoothed cursor position
        self._sx: float = screen_w / 2
        self._sy: float = screen_h / 2

        # Cooldowns
        self._click_cd = click_cooldown
        self._scroll_cd = scroll_cooldown
        self._key_cd = key_cooldown
        self._last_click = 0.0
        self._last_scroll = 0.0
        self._last_key = 0.0
        self._last_gesture = ''

        # Drag state
        self._dragging = False
        self._pinch_start_time = 0.0

        # Swipe tracking
        self._prev_index_y = 0.5
        self._swipe_history: List[float] = []

        # Gesture stability
        self._gesture_counts: Dict[str, int] = {}
        self._STABLE_FRAMES = 2

        # Active state
        self.active_gesture = 'IDLE'
        self.cursor_pos = (screen_w // 2, screen_h // 2)

    # ── Finger State Detection ──────────────────────────────────

    def _lm(self, landmarks: list, idx: int) -> Dict:
        """Get landmark by index."""
        return landmarks[idx]

    def _is_extended(self, lm: list, f: int) -> bool:
        if f == 0:  # Thumb
            ref_x = lm[INDEX_MCP]['x']
            return abs(lm[THUMB_TIP]['x'] - ref_x) > abs(lm[THUMB_IP]['x'] - ref_x)
        return lm[TIP[f]]['y'] < lm[MCP[f]]['y']

    def _is_folded(self, lm: list, f: int) -> bool:
        if f == 0:
            ref_x = lm[INDEX_MCP]['x']
            return abs(lm[THUMB_TIP]['x'] - ref_x) < abs(lm[THUMB_IP]['x'] - ref_x)
        return lm[TIP[f]]['y'] > lm[PIP[f]]['y']

    def _dist(self, a: Dict, b: Dict) -> float:
        return math.sqrt((a['x'] - b['x'])**2 + (a['y'] - b['y'])**2)

    def _finger_states(self, lm: list) -> Tuple[list, list]:
        ext = [self._is_extended(lm, f) for f in range(5)]
        fold = [self._is_folded(lm, f) for f in range(5)]
        return ext, fold

    # ── Gesture Detection ───────────────────────────────────────

    def _detect_gesture(self, lm: list) -> str:
        ext, fold = self._finger_states(lm)
        thuE, idxE, midE, rngE, pnkE = ext
        thuF, idxF, midF, rngF, pnkF = fold

        palm_y = (lm[WRIST]['y'] + lm[INDEX_MCP]['y'] + lm[PINKY_MCP]['y']) / 3

        # Pinch: thumb + index tips close
        pinch_dist = self._dist(lm[THUMB_TIP], lm[INDEX_TIP])
        if pinch_dist < 0.07:
            return 'PINCH'

        # Thumbs up
        if thuE and idxF and midF and rngF and pnkF:
            if lm[THUMB_TIP]['y'] < palm_y - 0.03:
                return 'THUMBS_UP'
            elif lm[THUMB_TIP]['y'] > palm_y + 0.03:
                return 'THUMBS_DOWN'

        # Middle finger
        if midE and idxF and rngF and pnkF:
            return 'MIDDLE_FINGER'

        # Peace
        if idxE and midE and rngF and pnkF:
            return 'PEACE'

        # Pointing
        if idxE and midF and rngF and pnkF:
            return 'POINTING'

        # Rock
        if idxE and pnkE and midF and rngF:
            return 'ROCK'

        # Three
        if idxE and midE and rngE and pnkF:
            return 'THREE'

        # Fist
        if thuF and idxF and midF and rngF and pnkF:
            return 'FIST'

        # Open palm
        if thuE and idxE and midE and rngE and pnkE:
            return 'OPEN_PALM'

        return 'IDLE'

    def _stabilize(self, gesture: str) -> str:
        """Require gesture for N consecutive frames."""
        for g in list(self._gesture_counts.keys()):
            if g != gesture:
                self._gesture_counts[g] = 0
        self._gesture_counts[gesture] = self._gesture_counts.get(gesture, 0) + 1
        if self._gesture_counts[gesture] >= self._STABLE_FRAMES:
            return gesture
        return self._last_gesture or 'IDLE'

    # ── Mouse Control ───────────────────────────────────────────

    def _move_cursor(self, norm_x: float, norm_y: float):
        """Map normalized hand coords to screen coords with smoothing."""
        m = self._margin
        # Map hand coords (margin..1-margin) → (0..screen)
        rx = max(0.0, min(1.0, (norm_x - m) / (1.0 - 2 * m)))
        ry = max(0.0, min(1.0, (norm_y - m) / (1.0 - 2 * m)))

        # Mirror X (camera is mirrored)
        target_x = (1.0 - rx) * self.screen_w
        target_y = ry * self.screen_h

        # Exponential moving average smoothing
        alpha = 1.0 - self._smoothing
        self._sx = self._sx + alpha * (target_x - self._sx)
        self._sy = self._sy + alpha * (target_y - self._sy)

        ix, iy = int(self._sx), int(self._sy)
        self._mouse.position = (ix, iy)
        self.cursor_pos = (ix, iy)

    def _left_click(self):
        now = time.time()
        if now - self._last_click > self._click_cd:
            self._mouse.click(Button.left)
            self._last_click = now
            return True
        return False

    def _right_click(self):
        now = time.time()
        if now - self._last_click > self._click_cd:
            self._mouse.click(Button.right)
            self._last_click = now
            return True
        return False

    def _double_click(self):
        now = time.time()
        if now - self._last_click > self._click_cd:
            self._mouse.click(Button.left, 2)
            self._last_click = now
            return True
        return False

    def _scroll(self, dy: int):
        now = time.time()
        if now - self._last_scroll > self._scroll_cd:
            self._mouse.scroll(0, dy)
            self._last_scroll = now
            return True
        return False

    def _press_key(self, key):
        now = time.time()
        if now - self._last_key > self._key_cd:
            self._kbd.press(key)
            self._kbd.release(key)
            self._last_key = now
            return True
        return False

    # ── Main Processing ─────────────────────────────────────────

    def process_frame(self, frame_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process one frame of hand data. Returns status dict.

        Args:
            frame_data: dict from HeadlessHandTracker.start_stream()

        Returns:
            {gesture, action, cursor_x, cursor_y}
        """
        result = {
            'gesture': 'IDLE',
            'action': 'none',
            'cursor_x': self.cursor_pos[0],
            'cursor_y': self.cursor_pos[1],
        }

        hands = frame_data.get('hands', [])
        if not hands:
            self.active_gesture = 'IDLE'
            self._last_gesture = 'IDLE'
            if self._dragging:
                self._mouse.release(Button.left)
                self._dragging = False
            return result

        # Use first hand (primary)
        hand = hands[0]
        lm = hand['landmarks']

        # Detect gesture with stability
        raw_gesture = self._detect_gesture(lm)
        gesture = self._stabilize(raw_gesture)
        self.active_gesture = gesture
        result['gesture'] = gesture

        # Index fingertip for cursor
        idx_tip = lm[INDEX_TIP]

        # ── Act on gesture ──────────────────────────────────────

        if gesture == 'POINTING':
            # Move cursor
            self._move_cursor(idx_tip['x'], idx_tip['y'])
            result['action'] = 'move'
            if self._dragging:
                self._mouse.release(Button.left)
                self._dragging = False

        elif gesture == 'PINCH':
            # Move cursor to pinch midpoint + click
            mid_x = (lm[THUMB_TIP]['x'] + lm[INDEX_TIP]['x']) / 2
            mid_y = (lm[THUMB_TIP]['y'] + lm[INDEX_TIP]['y']) / 2
            self._move_cursor(mid_x, mid_y)
            if self._left_click():
                result['action'] = 'click'

        elif gesture == 'FIST':
            if self._right_click():
                result['action'] = 'right_click'

        elif gesture == 'PEACE':
            if self._double_click():
                result['action'] = 'double_click'

        elif gesture == 'THUMBS_UP':
            if self._press_key(Key.enter):
                result['action'] = 'key_enter'

        elif gesture == 'THUMBS_DOWN':
            if self._press_key(Key.backspace):
                result['action'] = 'key_backspace'

        elif gesture == 'THREE':
            if self._press_key(Key.tab):
                result['action'] = 'key_tab'

        elif gesture == 'ROCK':
            if self._press_key(Key.esc):
                result['action'] = 'key_escape'

        elif gesture == 'OPEN_PALM':
            # Idle / stop
            if self._dragging:
                self._mouse.release(Button.left)
                self._dragging = False
            result['action'] = 'idle'

        # Swipe detection via index finger velocity
        curr_y = idx_tip['y']
        self._swipe_history.append(curr_y)
        if len(self._swipe_history) > 8:
            self._swipe_history.pop(0)
        if len(self._swipe_history) >= 6:
            delta = self._swipe_history[-1] - self._swipe_history[0]
            if delta < -0.12:
                if self._scroll(3):
                    result['action'] = 'scroll_up'
                    self._swipe_history.clear()
            elif delta > 0.12:
                if self._scroll(-3):
                    result['action'] = 'scroll_down'
                    self._swipe_history.clear()

        self._last_gesture = gesture
        result['cursor_x'] = self.cursor_pos[0]
        result['cursor_y'] = self.cursor_pos[1]
        return result
