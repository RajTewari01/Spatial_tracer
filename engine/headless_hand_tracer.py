'''
headless_hand_tracer.py 
>>> Features :
    1. Detects hands in the image
    2. Tracks hands across frames
NOTE : 
    - Its for a customize pyqt system with air gestures and flutter development  <using fastapi>
    - No opencv or any windows GUI
    - Flutter will act as the api between the backend and the gui.
>>> $ python d:/vision_tracking_engine/engine/headless_hand_tracer.py 
'''

from typing import Generator, Dict, List, Optional, Any
import mediapipe as mp
from pathlib import Path
import cv2
import gc
import time
import threading

_ROOT = Path(__file__).resolve().parents[1]


class HeadlessHandTracker:
    """
    Headless hand tracker using MediaPipe.
    Yields per-frame hand landmark data as dicts via a generator.
    No OpenCV windows — designed for FastAPI / WebSocket streaming.
    """

    __slots__ = [
        'hands', 'cap', 'height', 'width',
        '_running', '_lock', '_fps', '_frame_count',
        '_start_time'
    ]

    def __init__(
        self,
        height: int = 720,
        width: int = 1280,
        max_hands: int = 2,
        detection_confidence: float = 0.7,
        tracking_confidence: float = 0.7
    ):
        self.hands = mp.solutions.hands.Hands(
            static_image_mode=False,
            max_num_hands=max_hands,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence
        )
        self.width = width
        self.height = height
        self.cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._lock = threading.Lock()
        self._fps: float = 0.0
        self._frame_count: int = 0
        self._start_time: float = 0.0

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def fps(self) -> float:
        return round(self._fps, 1)

    def _extract_landmarks(
        self,
        hand_landmarks,
        handedness_label: str
    ) -> Dict[str, Any]:
        """Extract landmark data from a single hand into a serializable dict."""
        landmarks: List[Dict[str, float]] = []
        for idx, lm in enumerate(hand_landmarks.landmark):
            landmarks.append({
                "id": idx,
                "x": round(lm.x, 5),
                "y": round(lm.y, 5),
                "z": round(lm.z, 5),
            })

        # Pixel coordinates for fingertips (useful for hit testing)
        fingertip_ids = [4, 8, 12, 16, 20]  # thumb, index, middle, ring, pinky
        fingertips: List[Dict[str, Any]] = []
        for tip_id in fingertip_ids:
            lm = hand_landmarks.landmark[tip_id]
            fingertips.append({
                "id": tip_id,
                "x": round(lm.x, 5),
                "y": round(lm.y, 5),
                "px_x": int(lm.x * self.width),
                "px_y": int(lm.y * self.height),
            })

        return {
            "handedness": handedness_label,
            "landmarks": landmarks,
            "fingertips": fingertips,
        }

    def start_stream(self) -> Generator[Dict[str, Any], None, None]:
        """
        Generator that yields per-frame hand tracking data.
        
        Each yielded dict has the shape:
        {
            "timestamp": float,
            "fps": float,
            "frame_index": int,
            "hands": [
                {
                    "handedness": "Left" | "Right",
                    "landmarks": [{id, x, y, z}, ...],   # 21 landmarks
                    "fingertips": [{id, x, y, px_x, px_y}, ...],  # 5 tips
                },
                ...
            ]
        }
        """
        with self._lock:
            if self._running:
                return
            self._running = True

        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)

        if not self.cap.isOpened():
            self._running = False
            raise RuntimeError("Failed to open camera.")

        self._frame_count = 0
        self._start_time = time.time()

        try:
            while self._running:
                ret, frame = self.cap.read()
                if not ret:
                    break

                frame = cv2.flip(frame, 1)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = self.hands.process(rgb_frame)

                self._frame_count += 1
                elapsed = time.time() - self._start_time
                if elapsed > 0:
                    self._fps = self._frame_count / elapsed

                hands_data: List[Dict[str, Any]] = []

                if results.multi_hand_landmarks and results.multi_handedness:
                    for hand_landmarks, handedness_info in zip(
                        results.multi_hand_landmarks,
                        results.multi_handedness
                    ):
                        label = handedness_info.classification[0].label
                        hand_data = self._extract_landmarks(hand_landmarks, label)
                        hands_data.append(hand_data)

                yield {
                    "timestamp": round(time.time(), 3),
                    "fps": self.fps,
                    "frame_index": self._frame_count,
                    "hands": hands_data,
                }
        finally:
            self.stop_stream()

    def stop_stream(self) -> None:
        """Stop tracking and release camera resources."""
        self._running = False
        if self.cap and self.cap.isOpened():
            self.cap.release()
            self.cap = None
        gc.collect()

    def __del__(self):
        self.stop_stream()


# ── Quick self-test ──────────────────────────────────────────────
if __name__ == "__main__":
    import json

    tracker = HeadlessHandTracker()
    print("[headless] Starting stream... Press Ctrl+C to stop.")
    try:
        for frame_data in tracker.start_stream():
            if frame_data["hands"]:
                print(json.dumps(frame_data, indent=2)[:300], "...")
            else:
                print(f"[frame {frame_data['frame_index']}] No hands detected  "
                      f"({frame_data['fps']} FPS)", end="\r")
    except KeyboardInterrupt:
        tracker.stop_stream()
        print("\n[headless] Stopped.")