'''
fastapi_main.py
>>> Features :
    1. WebSocket streaming of hand landmark + gesture data
    2. REST endpoints for start/stop/status
    3. Serves web-client static files
    4. Integrates with pynput for keystroke injection
>>> $ uvicorn api.fastapi_main:app --host 0.0.0.0 --port 8765
'''

import asyncio
import json
import threading
import time
from pathlib import Path
from typing import Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

import sys
_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from engine.headless_hand_tracer import HeadlessHandTracker
from engine.gesture_detector import GestureDetector
from api.input_controller import InputController

# ── App init ─────────────────────────────────────────────────────
app = FastAPI(
    title="Vision Tracking Engine",
    description="Hand gesture tracking server with WebSocket streaming",
    version="1.0.0",
)

# ── Globals ──────────────────────────────────────────────────────
tracker = HeadlessHandTracker()
gesture_detector = GestureDetector()
input_controller = InputController()

# Connected WebSocket clients
connected_clients: Set[WebSocket] = set()

# Background tracker thread
_tracker_thread: threading.Thread | None = None
_latest_frame: dict | None = None
_frame_lock = threading.Lock()


# ── Static files (web client) ───────────────────────────────────
_WEB_CLIENT_DIR = _ROOT / "web-client"
if _WEB_CLIENT_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_WEB_CLIENT_DIR)), name="static")


# ── REST Endpoints ───────────────────────────────────────────────

@app.get("/")
async def index():
    """Serve the web client index page."""
    index_path = _WEB_CLIENT_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse({"message": "Vision Tracking Engine API", "status": "running"})


@app.post("/start")
async def start_tracking():
    """Start the headless hand tracker in a background thread."""
    global _tracker_thread

    if tracker.is_running:
        return JSONResponse({"status": "already_running"})

    _tracker_thread = threading.Thread(target=_run_tracker, daemon=True)
    _tracker_thread.start()

    # Wait briefly for the camera to initialize
    await asyncio.sleep(0.5)

    if tracker.is_running:
        return JSONResponse({"status": "started"})
    return JSONResponse({"status": "failed"}, status_code=500)


@app.post("/stop")
async def stop_tracking():
    """Stop the hand tracker."""
    if not tracker.is_running:
        return JSONResponse({"status": "not_running"})

    tracker.stop_stream()
    return JSONResponse({"status": "stopped"})


@app.get("/status")
async def get_status():
    """Get tracker status."""
    return JSONResponse({
        "running": tracker.is_running,
        "fps": tracker.fps,
        "connected_clients": len(connected_clients),
    })


@app.post("/press-key")
async def press_key(payload: dict):
    """Manually trigger a key press."""
    label = payload.get("key", "")
    success = input_controller.press_key(label)
    return JSONResponse({"key": label, "pressed": success})


# ── WebSocket ────────────────────────────────────────────────────

@app.websocket("/ws/hand-data")
async def websocket_hand_data(ws: WebSocket):
    """
    WebSocket endpoint that streams hand tracking + gesture data.
    
    Each message is a JSON frame:
    {
        "timestamp": float,
        "fps": float,
        "frame_index": int,
        "hands": [...],
        "gestures": [...]
    }
    """
    await ws.accept()
    connected_clients.add(ws)

    try:
        # Auto-start tracker if not running
        if not tracker.is_running:
            await start_tracking()

        while True:
            frame = _get_latest_frame()
            if frame:
                try:
                    await ws.send_json(frame)
                except Exception:
                    break
            else:
                # Send heartbeat when no frame data
                try:
                    await ws.send_json({
                        "timestamp": round(time.time(), 3),
                        "fps": 0,
                        "frame_index": -1,
                        "hands": [],
                        "gestures": [],
                        "status": "waiting",
                    })
                except Exception:
                    break

            # Throttle to ~30 FPS output
            await asyncio.sleep(0.033)

    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)


# ── Background tracker ──────────────────────────────────────────

def _run_tracker():
    """Run the headless tracker in a background thread, updating _latest_frame."""
    global _latest_frame

    try:
        for frame_data in tracker.start_stream():
            # Run gesture detection
            gestures = gesture_detector.detect_all_hands(frame_data)
            frame_data["gestures"] = gestures

            # Handle gesture → keystroke
            for gesture in gestures:
                if gesture.get("gesture") == "tap":
                    # In headless mode, we don't know which key was hit
                    # The desktop/web client handles key hit-testing
                    pass

            with _frame_lock:
                _latest_frame = frame_data

    except Exception as e:
        print(f"[tracker] Error: {e}")
    finally:
        with _frame_lock:
            _latest_frame = None


def _get_latest_frame() -> dict | None:
    """Get the latest frame data (thread-safe)."""
    with _frame_lock:
        frame = _latest_frame
    return frame


# ── Startup / shutdown ───────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    print("╔══════════════════════════════════════════════════╗")
    print("║   Vision Tracking Engine — Server Started       ║")
    print("║   Web Client: http://localhost:8765/             ║")
    print("║   WebSocket:  ws://localhost:8765/ws/hand-data   ║")
    print("╚══════════════════════════════════════════════════╝")


@app.on_event("shutdown")
async def on_shutdown():
    tracker.stop_stream()
    for ws in list(connected_clients):
        try:
            await ws.close()
        except Exception:
            pass
    connected_clients.clear()
    print("[server] Shutdown complete.")
