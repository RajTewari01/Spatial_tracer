'''
gesture_detector.py
>>> Features :
    1. Detects gestures from hand landmark data
    2. Supports: tap, pinch, swipe (left/right/up/down), open_palm
    3. Frame-history based for velocity detection (tap, swipe)
    4. Stateless per-call with internal history buffer
'''

from typing import Dict, List, Optional, Any
from collections import deque
import math
import time


# ── MediaPipe landmark IDs ──────────────────────────────────────
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_TIP = 12
RING_TIP = 16
PINKY_TIP = 20

THUMB_MCP = 2
INDEX_MCP = 5
MIDDLE_MCP = 9
RING_MCP = 13
PINKY_MCP = 17

WRIST = 0

FINGERTIP_IDS = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]
MCP_IDS = [THUMB_MCP, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP]


def _distance(a: Dict, b: Dict) -> float:
    """Euclidean distance between two landmarks (normalized coords)."""
    return math.sqrt(
        (a["x"] - b["x"]) ** 2 +
        (a["y"] - b["y"]) ** 2 +
        (a.get("z", 0) - b.get("z", 0)) ** 2
    )


def _get_landmark(landmarks: List[Dict], lid: int) -> Optional[Dict]:
    """Get landmark by ID from a list."""
    for lm in landmarks:
        if lm["id"] == lid:
            return lm
    return None


class GestureDetector:
    """
    Detects hand gestures from MediaPipe landmark data.

    Usage:
        detector = GestureDetector()
        gestures = detector.detect(hand_data)
        # gestures = [{"gesture": "tap", "confidence": 0.9, ...}, ...]
    """

    def __init__(
        self,
        history_size: int = 10,
        pinch_threshold: float = 0.05,
        tap_y_threshold: float = 0.03,
        tap_cooldown: float = 0.4,
        swipe_x_threshold: float = 0.12,
        swipe_y_threshold: float = 0.12,
        swipe_cooldown: float = 0.3,
    ):
        self._history_size = history_size
        self._pinch_threshold = pinch_threshold
        self._tap_y_threshold = tap_y_threshold
        self._tap_cooldown = tap_cooldown
        self._swipe_x_threshold = swipe_x_threshold
        self._swipe_y_threshold = swipe_y_threshold
        self._swipe_cooldown = swipe_cooldown

        # Per-hand history buffers keyed by handedness
        self._history: Dict[str, deque] = {}
        self._last_tap_time: Dict[str, float] = {}
        self._last_swipe_time: Dict[str, float] = {}

    def _get_history(self, hand_label: str) -> deque:
        if hand_label not in self._history:
            self._history[hand_label] = deque(maxlen=self._history_size)
            self._last_tap_time[hand_label] = 0.0
            self._last_swipe_time[hand_label] = 0.0
        return self._history[hand_label]

    def detect(self, hand_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Detect gestures for a single hand.

        Args:
            hand_data: dict with keys "handedness", "landmarks", "fingertips"

        Returns:
            List of detected gesture dicts, each with:
                - gesture: str  (tap, pinch, swipe_left, swipe_right, swipe_up, swipe_down, open_palm)
                - confidence: float  (0-1)
                - position: {x, y}  (normalized position of the primary landmark)
                - details: dict  (extra info per gesture)
        """
        landmarks = hand_data.get("landmarks", [])
        hand_label = hand_data.get("handedness", "Unknown")

        if len(landmarks) < 21:
            return []

        history = self._get_history(hand_label)
        now = time.time()

        # Store current index tip position in history
        index_tip = _get_landmark(landmarks, INDEX_TIP)
        if index_tip:
            history.append({
                "x": index_tip["x"],
                "y": index_tip["y"],
                "t": now,
            })

        gestures: List[Dict[str, Any]] = []

        # ── 1. Pinch detection ──────────────────────────────────
        pinch = self._detect_pinch(landmarks)
        if pinch:
            gestures.append(pinch)

        # ── 2. Tap detection ────────────────────────────────────
        tap = self._detect_tap(landmarks, history, hand_label, now)
        if tap:
            gestures.append(tap)

        # ── 3. Swipe detection ──────────────────────────────────
        swipe = self._detect_swipe(history, hand_label, now)
        if swipe:
            gestures.append(swipe)

        # ── 4. Open palm detection ──────────────────────────────
        palm = self._detect_open_palm(landmarks)
        if palm:
            gestures.append(palm)

        return gestures

    def _detect_pinch(self, landmarks: List[Dict]) -> Optional[Dict[str, Any]]:
        """Pinch = thumb tip close to index tip."""
        thumb = _get_landmark(landmarks, THUMB_TIP)
        index = _get_landmark(landmarks, INDEX_TIP)
        if not thumb or not index:
            return None

        dist = _distance(thumb, index)
        if dist < self._pinch_threshold:
            mid_x = (thumb["x"] + index["x"]) / 2
            mid_y = (thumb["y"] + index["y"]) / 2
            confidence = max(0.0, 1.0 - (dist / self._pinch_threshold))
            return {
                "gesture": "pinch",
                "confidence": round(confidence, 3),
                "position": {"x": round(mid_x, 4), "y": round(mid_y, 4)},
                "details": {"distance": round(dist, 5)},
            }
        return None

    def _detect_tap(
        self,
        landmarks: List[Dict],
        history: deque,
        hand_label: str,
        now: float
    ) -> Optional[Dict[str, Any]]:
        """
        Tap = index fingertip rapid downward motion (y increases)
        followed by a stop or upward motion. We look for a spike
        in y-velocity over the last few frames.
        """
        if len(history) < 4:
            return None

        if now - self._last_tap_time.get(hand_label, 0) < self._tap_cooldown:
            return None

        # Look at the last 4 data points
        recent = list(history)[-4:]
        y_vals = [p["y"] for p in recent]

        # Phase 1: downward movement (y increasing in screen coords)
        down_delta = y_vals[-2] - y_vals[0]
        # Phase 2: upward or stop
        up_delta = y_vals[-1] - y_vals[-2]

        if down_delta > self._tap_y_threshold and up_delta < 0:
            index_tip = _get_landmark(landmarks, INDEX_TIP)
            if index_tip:
                self._last_tap_time[hand_label] = now
                confidence = min(1.0, down_delta / (self._tap_y_threshold * 2))
                return {
                    "gesture": "tap",
                    "confidence": round(confidence, 3),
                    "position": {
                        "x": round(index_tip["x"], 4),
                        "y": round(index_tip["y"], 4),
                    },
                    "details": {
                        "down_delta": round(down_delta, 5),
                        "up_delta": round(up_delta, 5),
                    },
                }
        return None

    def _detect_swipe(
        self,
        history: deque,
        hand_label: str,
        now: float
    ) -> Optional[Dict[str, Any]]:
        """
        Swipe = large horizontal or vertical displacement of index tip
        over the last N frames.
        """
        if len(history) < 5:
            return None

        if now - self._last_swipe_time.get(hand_label, 0) < self._swipe_cooldown:
            return None

        recent = list(history)[-6:]
        dx = recent[-1]["x"] - recent[0]["x"]
        dy = recent[-1]["y"] - recent[0]["y"]
        dt = recent[-1]["t"] - recent[0]["t"]

        if dt < 0.05:
            return None

        abs_dx = abs(dx)
        abs_dy = abs(dy)

        direction = None
        magnitude = 0.0

        if abs_dx > self._swipe_x_threshold and abs_dx > abs_dy:
            direction = "swipe_right" if dx > 0 else "swipe_left"
            magnitude = abs_dx
        elif abs_dy > self._swipe_y_threshold and abs_dy > abs_dx:
            direction = "swipe_down" if dy > 0 else "swipe_up"
            magnitude = abs_dy

        if direction:
            self._last_swipe_time[hand_label] = now
            threshold = self._swipe_x_threshold if "left" in direction or "right" in direction else self._swipe_y_threshold
            confidence = min(1.0, magnitude / (threshold * 2))
            return {
                "gesture": direction,
                "confidence": round(confidence, 3),
                "position": {
                    "x": round(recent[-1]["x"], 4),
                    "y": round(recent[-1]["y"], 4),
                },
                "details": {
                    "dx": round(dx, 5),
                    "dy": round(dy, 5),
                    "dt": round(dt, 4),
                    "velocity": round(magnitude / dt, 3),
                },
            }
        return None

    def _detect_open_palm(self, landmarks: List[Dict]) -> Optional[Dict[str, Any]]:
        """
        Open palm = all five fingertips are above (lower y) their 
        respective MCP joints. For thumb, we check x-distance from wrist
        instead since thumb moves laterally.
        """
        fingers_extended = 0

        for tip_id, mcp_id in zip(FINGERTIP_IDS, MCP_IDS):
            tip = _get_landmark(landmarks, tip_id)
            mcp = _get_landmark(landmarks, mcp_id)
            if not tip or not mcp:
                return None

            if tip_id == THUMB_TIP:
                # Thumb: check if tip is farther from wrist than MCP
                wrist = _get_landmark(landmarks, WRIST)
                if wrist:
                    tip_dist = abs(tip["x"] - wrist["x"])
                    mcp_dist = abs(mcp["x"] - wrist["x"])
                    if tip_dist > mcp_dist:
                        fingers_extended += 1
            else:
                # Other fingers: tip should be above MCP (lower y)
                if tip["y"] < mcp["y"]:
                    fingers_extended += 1

        if fingers_extended >= 5:
            wrist = _get_landmark(landmarks, WRIST)
            pos = {"x": 0.5, "y": 0.5}
            if wrist:
                pos = {"x": round(wrist["x"], 4), "y": round(wrist["y"], 4)}
            return {
                "gesture": "open_palm",
                "confidence": 1.0,
                "position": pos,
                "details": {"fingers_extended": fingers_extended},
            }
        return None

    def detect_all_hands(
        self,
        frame_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Convenience: detect gestures for all hands in a frame.
        
        Args:
            frame_data: the full dict yielded by HeadlessHandTracker.start_stream()
        
        Returns:
            List of gesture dicts (across all hands in the frame).
        """
        all_gestures: List[Dict[str, Any]] = []
        for hand in frame_data.get("hands", []):
            gestures = self.detect(hand)
            for g in gestures:
                g["hand"] = hand.get("handedness", "Unknown")
            all_gestures.extend(gestures)
        return all_gestures


# ── Quick self-test ──────────────────────────────────────────────
if __name__ == "__main__":
    # Synthetic test: create a fake "pinch" scenario
    fake_landmarks = [{"id": i, "x": 0.5, "y": 0.5, "z": 0.0} for i in range(21)]
    # Move thumb and index close together
    fake_landmarks[THUMB_TIP] = {"id": THUMB_TIP, "x": 0.5, "y": 0.5, "z": 0.0}
    fake_landmarks[INDEX_TIP] = {"id": INDEX_TIP, "x": 0.52, "y": 0.51, "z": 0.0}

    detector = GestureDetector()
    result = detector.detect({
        "handedness": "Right",
        "landmarks": fake_landmarks,
        "fingertips": [],
    })
    print("Pinch test:", result)

    # Synthetic open palm: all tips above MCPs
    palm_landmarks = [{"id": i, "x": 0.5, "y": 0.8, "z": 0.0} for i in range(21)]
    for tip_id in FINGERTIP_IDS:
        palm_landmarks[tip_id] = {"id": tip_id, "x": 0.5, "y": 0.2, "z": 0.0}
    for mcp_id in MCP_IDS:
        palm_landmarks[mcp_id] = {"id": mcp_id, "x": 0.5, "y": 0.6, "z": 0.0}
    # Thumb needs x-distance check
    palm_landmarks[THUMB_TIP] = {"id": THUMB_TIP, "x": 0.2, "y": 0.3, "z": 0.0}
    palm_landmarks[THUMB_MCP] = {"id": THUMB_MCP, "x": 0.4, "y": 0.5, "z": 0.0}
    palm_landmarks[WRIST] = {"id": WRIST, "x": 0.5, "y": 0.8, "z": 0.0}

    result2 = detector.detect({
        "handedness": "Right",
        "landmarks": palm_landmarks,
        "fingertips": [],
    })
    print("Open palm test:", result2)
