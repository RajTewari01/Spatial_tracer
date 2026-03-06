'''
headless_hand_tracer.py 
>>> Features :
    1. Detects hands in the image
    2. Tracks hands across frames asn
NOTE : 
    - Its for a customize pyqt system with air gestures and flutter development  <using fastapi>
    - No opencv or any windows GUI
    - Flutter will act as the api between the backend and the gui.
>>> $ python d:/vision_tracking_engine/engine/headless_hand_tracer.py 
'''

from typing import Tuple, Generator, Dict, Optional
import mediapipe as mp
from pathlib import Path
import cv2
import gc
import sys

_ROOT = Path(__file__).resolve().parents[1]
_KEYS_MAPPING = _ROOT / "config/mapping.json"

class InitilizeCamera:

    __slots__ = ['load_model','hands','cap','height','width']

    def __init__(self,load_model:bool=False,height:int=720,width:int=1280):
        self.load_model = load_model
        self.hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=2, # Optimized for 2-hand typing
                min_detection_confidence=0.7,
                min_tracking_confidence=0.7
            )
        self.width = width
        self.height = height
        self.cap = None

    def release_camera(self):
        if self.cap : self.cap.release()
        gc.collect()
    
    def __del__(self):
        self.release_camera()
    
    def start_stream(
        self
    ) ->Generator[Dict, None, None] : 
        '''
        >>> we will yeild as we will use a generator here to feed the raw data to the backend via our fastapi
        '''
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)