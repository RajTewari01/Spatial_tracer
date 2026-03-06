'''
simple_hand_tracer.py
>>> Features :
    1. Detects hands in the image with OpenCV window
    2. Tracks hands across frames
    3. Draws keyboard overlay from mapping.json
NOTE: This is the visual/debug tracer. For headless usage, see headless_hand_tracer.py
'''

from typing import Tuple
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
import sys
import numpy as np

_ROOT = Path(__file__).resolve().parents[1]
_KEYS_MAPPING = _ROOT / "config/mapping.json"
_MODEL_PATH = _ROOT / "config" / "hand_landmarker.task"

# MediaPipe hand connections for drawing
HAND_CONNECTIONS = [
    (0,1),(1,2),(2,3),(3,4),
    (0,5),(5,6),(6,7),(7,8),
    (0,9),(9,10),(10,11),(11,12),
    (0,13),(13,14),(14,15),(15,16),
    (0,17),(17,18),(18,19),(19,20),
    (5,9),(9,13),(13,17),
]


class InitializeCamera:

    __slots__ = ['try_load_model', 'cam', 'dataset_path']

    def __init__(self, try_load_model: bool = False):
        self.try_load_model = try_load_model
        self.cam = None
        self.dataset_path = _KEYS_MAPPING
        assert self.dataset_path.exists(), 'Hey you cannot continue without the key-mapping.'

    def _create_landmarker(self) -> HandLandmarker:
        """Create the MediaPipe HandLandmarker."""
        assert _MODEL_PATH.exists(), (
            f"Model not found: {_MODEL_PATH}\n"
            "Download from: https://storage.googleapis.com/"
            "mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
        )
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(_MODEL_PATH)),
            running_mode=RunningMode.VIDEO,
            num_hands=2,
            min_hand_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        return HandLandmarker.create_from_options(options)

    def _draw_landmarks(self, frame, hand_landmarks):
        """Draw hand landmarks and connections on frame."""
        height, width, _ = frame.shape
        points = {}
        for idx, lm in enumerate(hand_landmarks):
            px, py = int(lm.x * width), int(lm.y * height)
            points[idx] = (px, py)
            cv2.circle(frame, (px, py), 3, (58, 166, 255), -1)

        for a, b in HAND_CONNECTIONS:
            if a in points and b in points:
                cv2.line(frame, points[a], points[b], (58, 166, 255, 150), 2)

    def initialize_camera(self):
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        return cap

    def start_camera(self, cap: Tuple):
        data_set = None
        cv2.namedWindow("camera", cv2.WINDOW_NORMAL)

        import json
        with open(self.dataset_path, 'r') as infile:
            raw_data = json.load(infile)
            if not raw_data:
                raise ValueError("Needs the mapping for the dynamic keys.")

        landmarker = self._create_landmarker()
        frame_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Convert to MediaPipe Image
            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )
            frame_count += 1
            timestamp_ms = int(frame_count * (1000 / 30))

            results = landmarker.detect_for_video(mp_image, timestamp_ms)

            if results.hand_landmarks:
                for hand_landmarks in results.hand_landmarks:
                    self._draw_landmarks(frame, hand_landmarks)
                    height, width, channel = frame.shape
                    index_finger = hand_landmarks[8]
                    index_finger_x = int(index_finger.x * width)
                    index_finger_y = int(index_finger.y * height)
                    cv2.circle(frame, (index_finger_x, index_finger_y), 10,
                               (0, 255, 0), cv2.FILLED)
                    data_set = raw_data.get('keys')
                    assert data_set, 'Data cannot be found.'
                    for i in data_set:
                        py_x = int(i.get('x') * width)
                        py_y = int(i.get('y') * height)
                        py_w = int(i.get('w') * width)
                        py_h = int(i.get('h') * height)
                        cv2.rectangle(frame, (py_x, py_y),
                                      (py_x + py_w, py_y + py_h), (255, 255, 10), 3)
                        cv2.putText(frame, i['label'], (py_x + 17, py_y + 27),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

            cv2.imshow("Camera", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                landmarker.close()
                self.release_camera(cap)
                sys.exit(0)

    def release_camera(self, cap):
        cap.release()
        cv2.destroyAllWindows()
        gc.collect()
        return True

    def run(self):
        if self.try_load_model:
            self.cam = self.initialize_camera()
            self.start_camera(self.cam)


if __name__ == "__main__":
    InitializeCamera(try_load_model=True).run()
