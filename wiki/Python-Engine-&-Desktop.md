# Python Engine & Desktop Application

The `engine/` and `desktop-client/` directories encapsulate the entire logic required to transform spatial parameters into low-level Windows, macOS, or Linux HID interfaces.

## 1. The Headless Inference Engine (`engine/`)

The Python engine is engineered to run perpetually in the background with near-zero UI overhead, maximizing CPU scheduling for inference.

### Core Modules
*   **`headless_hand_tracer.py`**: The main execution loop. It binds to `cv2.VideoCapture(0)` to read raw bytes. Unlike naive implementations, it runs MediaPipe in `Tasks` mode which uses an internal multithreaded executor to decouple camera I/O lag from AI inference bottlenecks.
*   **`gesture_detector.py`**: An atomic pure-Python class that takes in NumPy arrays and spits out `Enum` gesture states. It houses the 2-frame stability buffer and the dictionary that maps finger bitmasks to Gestures.
*   **`air_input_driver.py`**: The bridge between Python logic and the OS kernel. This module depends strictly on the `pynput` library.

### OS Interfacing (`pynput`)
The driver does not directly inject mouse/keyboard events. Instead, it maintains a singleton Controller instances for both peripherals:

```python
from pynput.mouse import Controller as MouseController
from pynput.keyboard import Controller as KbdController, Key

mouse = MouseController()
keyboard = KbdController()

def execute_click():
    mouse.press(Button.left)
    mouse.release(Button.left)
```

**Cursor Mapping Constraints:**
A camera captures a 4:3 or 16:9 frame, but a user's monitor might be ultrawide or dual-screen. The engine normalizes the camera inputs `[X, Y]` and dynamically multiplies them against `win32api` screen dimension resolutions, accounting for a customizable 10% "deadband" edge to ensure the cursor can easily hit the corner of a screen without over-stretching the arm.

## 2. PyQt5 Desktop Overlay (`desktop-client/`)

Spatial_Tracer isn't just invisible; it requires feedback. The `desktop-client` provides a revolutionary glassmorphic heads-up display.

### The Frameless Transparent Window
We use `PyQt5` configured with ultra-specific Windows API flags to render a fully transparent canvas overlaid directly over the operating system, allowing clicks to pass through except when hovering over widgets.

```python
# PyQt5 Window Initialization
self.setWindowFlags(
    Qt.FramelessWindowHint | 
    Qt.WindowStaysOnTopHint | 
    Qt.Tool
)
self.setAttribute(Qt.WA_TranslucentBackground)
```

### The Virtual Keyboard
The hallmark feature is the floating air keyboard. 
1.  **Ray-casting simulation**: Since real mouse APIs exist, the Python script mathematically checks if the user's "Air Cursor" bounding box intersects with the `QButton` geometries of the virtual keys.
2.  **Hover State**: If intersected, the `QButton` receives a custom stylesheet injection transforming it into a glowing hue.
3.  **Key Event**: Upon a `PINCH` gesture, the engine reads the active QButton's label, translates it via `pynput.keyboard`, and initiates a local vibration or visual pop effect.
