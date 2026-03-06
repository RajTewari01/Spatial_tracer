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
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    HandLandmarkerResult,
)
from mediapipe.tasks.python.vision.hand_landmarker import _RunningMode as RunningMode
from pathlib import Path
import cv2
import gc
import time
import threading
import numpy as np

_ROOT = Path(__file__).resolve().parents[1]
_MODEL_PATH = _ROOT / "config" / "hand_landmarker.task"


class HeadlessHandTracker:
    """
    Headless hand tracker using MediaPipe Tasks API.
    Yields per-frame hand landmark data as dicts via a generator.
    No OpenCV windows — designed for FastAPI / WebSocket streaming.
    """

    def __init__(
        self,
        height: int = 720,
        width: int = 1280,
        max_hands: int = 2,
        detection_confidence: float = 0.5,
        tracking_confidence: float = 0.5
    ):
        self.width = width
        self.height = height
        self._max_hands = max_hands
        self._detection_confidence = detection_confidence
        self._tracking_confidence = tracking_confidence
        self.cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._lock = threading.Lock()
        self._fps: float = 0.0
        self._frame_count: int = 0
        self._start_time: float = 0.0
        self._landmarker: Optional[HandLandmarker] = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def fps(self) -> float:
        return round(self._fps, 1)

    def _create_landmarker(self) -> HandLandmarker:
        """Create the MediaPipe HandLandmarker."""
        model_path = str(_MODEL_PATH)
        if not _MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Hand landmarker model not found at {model_path}. "
                "Download from: https://storage.googleapis.com/mediapipe-models/"
                "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
            )

        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=RunningMode.VIDEO,
            num_hands=self._max_hands,
            min_hand_detection_confidence=self._detection_confidence,
            min_tracking_confidence=self._tracking_confidence,
        )
        return HandLandmarker.create_from_options(options)

    def _extract_landmarks(
        self,
        result: HandLandmarkerResult,
    ) -> List[Dict[str, Any]]:
        """Extract landmark data from MediaPipe result into serializable dicts."""
        hands_data: List[Dict[str, Any]] = []

        if not result.hand_landmarks:
            return hands_data

        for hand_idx, hand_landmarks in enumerate(result.hand_landmarks):
            # Get handedness
            handedness_label = "Unknown"
            if result.handedness and hand_idx < len(result.handedness):
                handedness_label = result.handedness[hand_idx][0].category_name

            landmarks: List[Dict[str, float]] = []
            for idx, lm in enumerate(hand_landmarks):
                landmarks.append({
                    "id": idx,
                    "x": round(lm.x, 5),
                    "y": round(lm.y, 5),
                    "z": round(lm.z, 5),
                })

            # Pixel coordinates for fingertips
            fingertip_ids = [4, 8, 12, 16, 20]
            fingertips: List[Dict[str, Any]] = []
            for tip_id in fingertip_ids:
                lm = hand_landmarks[tip_id]
                fingertips.append({
                    "id": tip_id,
                    "x": round(lm.x, 5),
                    "y": round(lm.y, 5),
                    "px_x": int(lm.x * self.width),
                    "px_y": int(lm.y * self.height),
                })

            hands_data.append({
                "handedness": handedness_label,
                "landmarks": landmarks,
                "fingertips": fingertips,
            })

        return hands_data

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

        # Create landmarker
        self._landmarker = self._create_landmarker()

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

                # Convert to MediaPipe Image
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=rgb_frame
                )

                self._frame_count += 1
                timestamp_ms = int(self._frame_count * (1000 / 30))  # Approximate

                # Run detection
                result = self._landmarker.detect_for_video(mp_image, timestamp_ms)

                elapsed = time.time() - self._start_time
                if elapsed > 0:
                    self._fps = self._frame_count / elapsed

                hands_data = self._extract_landmarks(result)

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
        if self._landmarker:
            self._landmarker.close()
            self._landmarker = None
        gc.collect()

    def __del__(self):
        try:
            self.stop_stream()
        except Exception:
            pass


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