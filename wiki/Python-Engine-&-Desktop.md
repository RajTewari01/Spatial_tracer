# Python Engine & Desktop Application

The `engine/`, `api/`, and `desktop-client/` directories contain the full logic for transforming spatial hand coordinates into real OS-level mouse/keyboard inputs on Windows.

## 1. The Headless Inference Engine (`engine/`)

The Python engine runs in the background with zero GUI overhead, maximizing CPU scheduling for inference.

### Core Modules

| File | Lines | Purpose |
|:-----|:------|:--------|
| `headless_hand_tracer.py` | 241 | Main camera loop. Binds `cv2.VideoCapture(0)`, runs MediaPipe `HandLandmarker` in `VIDEO` mode using the local TFLite model at `config/hand_landmarker.task` (7.8 MB). Default resolution: 1280×720, desktop override: 640×480. Yields per-frame data as a Python generator. |
| `gesture_detector.py` | 366 | Stateless per-call gesture classifier with internal frame history buffer. Detects `tap`, `pinch`, `swipe`, `open_palm` using velocity analysis (`deque(maxlen=10)`) and distance thresholds. Pinch threshold: `0.05`, tap Y-threshold: `0.03`. |
| `air_input_driver.py` | 358 | OS bridge via `pynput`. Maintains singleton `MouseController` + `KbdController`. Implements EMA smoothing, margin clamping, cooldown timers, and the full 13-gesture→action mapping. |
| `simple_hand_tracer.py` | ~170 | Debug-only: Opens an OpenCV window showing the raw camera feed with hand skeleton drawn. Press `q` to quit. |
| `__init__.py` | 8 | Package exports: `HeadlessHandTracker`, `GestureDetector` |

### Cursor Mapping Pipeline

```
Index Fingertip (0.0—1.0) → Margin Clamp (8% dead zone) → Screen Mapping (× resolution) → EMA Smoothing (α=0.6) → pynput mouse.position
```

**Smoothing parameters** (defaults in `air_input_driver.py`, overridden in `desktop-client/app.py`):

| Parameter | Driver Default | Desktop Override | Formula |
|:----------|:--------------|:-----------------|:--------|
| `smoothing` | `0.35` | `0.4` | `α = 1.0 - smoothing` → 0.65 / 0.6 |
| `margin` | `0.08` (8%) | `0.1` (10%) | Dead zone at screen edges |
| `screen_w × screen_h` | `1920 × 1080` | Auto-detected via `ctypes.windll.user32.GetSystemMetrics` | — |

### Gesture→Action Mapping (Desktop)

| Gesture | pynput Action | Cooldown |
|:--------|:-------------|:---------|
| POINTING | `mouse.position = (sx, sy)` | Per-frame |
| PEACE | `mouse.press(Button.left)` / double-click | 400ms |
| FIST | `mouse.press(Button.right)` | 400ms |
| PINCH | Left click / drag start | 400ms |
| THUMBS_UP | `mouse.scroll(0, 3)` + `Key.enter` | 150ms scroll, 500ms key |
| THUMBS_DOWN | `mouse.scroll(0, -3)` + `Key.backspace` | 150ms scroll, 500ms key |
| THREE | `Key.tab` | 500ms |
| ROCK | `Key.esc` | 500ms |
| OPEN_PALM | Release / idle | — |

## 2. FastAPI Server (`api/`)

| File | Lines | Purpose |
|:-----|:------|:--------|
| `fastapi_main.py` | 234 | ASGI server via Uvicorn. Serves `web-client/` as static files at `/`. WebSocket at `/ws/hand-data` streams JSON frames at ~30 FPS. REST endpoints: `/start`, `/stop`, `/status`, `/press-key`. Auto-starts tracker on first WebSocket connection. |
| `input_controller.py` | 136 | Remote keystroke injection. Maps virtual keyboard labels to `pynput.Key` constants. Supports modifier stacking (Shift+Ctrl+key) with one-shot auto-reset. |

### WebSocket Frame Format

```json
{
  "timestamp": 1711574400.123,
  "fps": 28.5,
  "frame_index": 1204,
  "hands": [
    {
      "handedness": "Right",
      "landmarks": [{"id": 0, "x": 0.52, "y": 0.71, "z": -0.02}, ...],
      "fingertips": [{"id": 8, "x": 0.55, "y": 0.35, "px_x": 352, "px_y": 168}, ...]
    }
  ],
  "gestures": [{"gesture": "peace", "confidence": 0.92, "position": {"x": 0.55, "y": 0.35}}]
}
```

## 3. PyQt5 Desktop Overlay (`desktop-client/`)

The desktop client is an 814-line PyQt5 application providing a frameless, transparent, always-on-top HUD.

| File | Lines | Purpose |
|:-----|:------|:--------|
| `app.py` | 814 | Main overlay window. Contains `TrackingThread` (QThread running HeadlessHandTracker + GestureDetector + AirInputDriver in-process), `CameraPanel` (280×180 preview with skeleton drawing), and `OverlayWindow` (300×280 draggable panel with Start/Stop, gesture badge, keyboard toggle, camera minimize). |
| `virtual_keyboard.py` | 317 | Full QWERTY keyboard widget (69 keys across 5 rows). Glassmorphic dark theme with hover highlights, active modifier states, and green flash feedback on tap. Finger cursor overlay via custom `paintEvent`. |
| `camera_widget.py` | 272 | Alternative WebSocket-based camera widget (connects to FastAPI server instead of running tracker in-process). Used when running in server mode. |

### Window Flags (Transparent Overlay)

```python
self.setWindowFlags(
    Qt.FramelessWindowHint |   # No title bar or borders
    Qt.WindowStaysOnTopHint |  # Always visible over all apps
    Qt.Tool                    # Hidden from taskbar
)
self.setAttribute(Qt.WA_TranslucentBackground)  # Transparent background
```

### Virtual Keyboard Interaction

The keyboard uses a two-hand gesture system:
1. **POINTING/PEACE** → Index finger highlights keys as cursor moves over them
2. **PINCH** → Activates the key at the midpoint between thumb and index tips
3. **Modifiers** (SHIFT, CTRL, ALT, WIN) → Highlighted when hovered, held across the next keypress
4. **Long-press** → Holding PINCH on DEL/BACK for 4 seconds triggers Ctrl+A → Delete (select-all + clear)

Screen resolution is auto-detected via Windows API:
```python
import ctypes
user32 = ctypes.windll.user32
SCREEN_W = user32.GetSystemMetrics(0)
SCREEN_H = user32.GetSystemMetrics(1)
```
