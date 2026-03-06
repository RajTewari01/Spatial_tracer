'''
handtracker.py 
>>> Features :
    1. Detects hands in the image
    2. Tracks hands across frames
'''

from typing import Tuple
import mediapipe as mp
from pathlib import Path
import cv2
import gc
import sys

_ROOT = Path(__file__).resolve().parents[1]
_KEYS_MAPPING = _ROOT / "config/mapping.json"

class InitilizeCamera:

    __slots__ = ['try_load_model', 'cam','load_hand','hands','mp_draw','dataset_path']
    
    def __init__(self,try_load_model:bool=False):
      self.try_load_model = try_load_model
      self.cam = None
      self.load_hand = mp.solutions.hands
      self.hands = self.load_hand.Hands(
       max_num_hands=2,
       min_detection_confidence=0.5,
       min_tracking_confidence=0.5
      )
      
      self.mp_draw = mp.solutions.drawing_utils
      self.dataset_path = _KEYS_MAPPING
      assert self.dataset_path.exists(),'Hey you cannot continue without the key-mapping.'
      

    def initialize_camera(self):
      cap = cv2.VideoCapture(0)
      cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
      cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
      return cap
    
    def start_camera(self,
    cap: Tuple
    ):
      data_set = None
      cv2.namedWindow("camera", cv2.WINDOW_NORMAL)

      import json
      with open(self.dataset_path,'r') as infile:
        raw_data = json.load(infile)
        if not raw_data: raise ValueError("Needs the mapping for the dynamic keys.")

      while True:
        ret, frame = cap.read()
        if not ret:
          break

        frame = cv2.flip(frame, 1)

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)

        if results.multi_hand_landmarks:
          for hand_landmarks in results.multi_hand_landmarks:
            self.mp_draw.draw_landmarks(frame, hand_landmarks, self.load_hand.HAND_CONNECTIONS)
            height, width, channel = frame.shape
            index_finger = hand_landmarks.landmark[8]
            index_finger_x = int(index_finger.x * width)
            index_finger_y = int(index_finger.y * height)
            cv2.circle(frame, (index_finger_x, index_finger_y), 10, (0, 255, 0), cv2.FILLED) #cv2.FILLED make the circle filled with solid color
            data_set = raw_data.get('keys')
            assert data_set,'Data cannot be found.'
            for i in data_set:
              py_x = int(i.get('x') * width) 
              py_y = int(i.get('y') * height)
              py_w = int(i.get('w') * width)
              py_h = int(i.get('h') * height)
              cv2.rectangle(frame,(py_x,py_y),(py_x+py_w,py_y+py_h), (255,255,10), 3) 
              cv2.putText(frame,i['label'],(py_x + 17, py_y + 27),
              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)



        cv2.imshow("Camera", frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
          self.release_camera(cap)
          sys.exit(0)

    def release_camera(self, cap):
        cap.release()
        cv2.destroyAllWindows()
        gc.collect()
        return True
    
    def run(
        self
    ):
        if self.try_load_model:
            self.cam = self.initialize_camera()
            self.start_camera(self.cam)
    
      

if __name__ == "__main__":
  InitilizeCamera(try_load_model=True).run()
