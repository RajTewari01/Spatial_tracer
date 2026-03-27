# Web Client & API Reference

The Web Client provides an interactive sandbox illustrating our atomic gesture components. It's fully decoupled from the heavier desktop/mobile builds and acts as both an educational tool and standalone browser app.

## The FastAPI Layer (`api/`)

The Python engine natively spawns an ASGI `FastAPI` server bounded to `Uvicorn` worker processes. 

### Why FastAPI?
We require instantaneous coordinate data transfer. FastAPI supports native WebSockets built upon `Starlette`, capable of transmitting JSON frames at 60Hz.

### HTTP Endpoints
1.  `GET /`: Mounts `web-client` as a `StaticFiles` response. This allows the API itself to host the browser UI.
2.  `GET /status`: A JSON heartbeat endpoint checking GPU/CPU hardware loads and the active queue of connected WebSocket clients.
3.  `WS /ws/hand-data`: The core engine pipe.
    ```python
    @app.websocket("/ws/hand-data")
    async def websocket_hand_endpoint(websocket: WebSocket):
        await websocket.accept()
        # Bi-directional stream:
        # 1. Receive JSON gestures from browser.
        # 2. Push generated 3D vector positions to browser.
    ```

## Browser Rendering Engine (`web-client/`)

The front-end avoids bulky frameworks (React/Vue). It leverages Vanilla JavaScript to talk to the GPU directly.

### Native Data Capture
The browser securely requests camera permissions using:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 720, height: 480 } });
videoElement.srcObject = stream;
```

### WebAssembly MediaPipe execution
Rather than transferring 2MB images across WebSockets per-frame, we run Google's `MediaPipe JS` build. The models are instantiated dynamically via unpkg CDNs. Inference happens exclusively inside the user's browser via local WebAssembly, pushing the burden entirely off the `FastAPI` host.

### The Three.js 4000 Particle Engine
For deep "wow" factor, the demo UI employs `Three.js` (a webgl overlay).
*   **The Particle System**: We instantiate an array of 4,000 spatial dot particles.
*   **Collision Avoidance Mathematics**:
    When the WebAssembly layer detects an `OPEN_PALM`, the JS engine applies a repulsive bounding box at the `X, Y, Z` centroid of the palm.
    Every single frame, all 4,000 particles apply a repulsive vertex shader calculation to dodge the user's moving hand in 3D virtual space.
