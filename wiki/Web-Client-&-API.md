# Web Client & API Reference

The Web Client is a **fully standalone browser application** — it does NOT require the Python server. MediaPipe runs as a WASM module loaded directly from CDN. The optional FastAPI server can serve the files, but any static file server works.

## Browser Rendering Engine (`web-client/`)

Three files, zero build tools, zero dependencies to install:

| File | Size | Purpose |
|:-----|:-----|:--------|
| `index.html` | 5.4 KB | Entry HTML — loads Three.js r128, MediaPipe Hands/Camera/Drawing WASM from CDN, Google Fonts (Inter + JetBrains Mono) |
| `app.js` | 31 KB | Complete application: Typewriter engine, MediaPipe camera integration, 13-gesture detector, 4000-particle Three.js sphere with physics, UI state management |
| `style.css` | 22.5 KB | Glassmorphic dark theme, responsive layout, camera PiP panel, info panel, gesture flash overlay |

### CDN Dependencies (loaded in `index.html`)

```html
<!-- Three.js r128 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

<!-- MediaPipe Hands WASM -->
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.min.js"></script>
```

### Camera Initialization

The browser requests camera permissions using the standard Web API:
```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 720, height: 480 }
});
videoElement.srcObject = stream;
```

MediaPipe Hands processes every frame locally via WebAssembly — **no data leaves the browser**.

### Gesture Detection (13 Gestures)

The web client implements all 13 gestures using the same `tip.y < MCP.y` deterministic algorithm, with these constants:

| Constant | Value | Purpose |
|:---------|:------|:--------|
| `TIP` | `[4, 8, 12, 16, 20]` | Fingertip landmark IDs |
| `PIP` | `[3, 6, 10, 14, 18]` | Mid-joint IDs (for fold detection) |
| `MCP` | `[2, 5, 9, 13, 17]` | Knuckle IDs (for extension detection) |
| Pinch threshold | `dist < 0.07` | Euclidean distance between thumb tip and index tip |
| OK threshold | `dist < 0.08` + middle/ring/pinky extended | — |
| Stability buffer | 2 consecutive frames | Same as all platforms |

**Gesture catalog (from `app.js`):**
`THUMBS_UP`, `THUMBS_DOWN`, `PEACE`, `MIDDLE_FINGER`, `ROCK`, `OK_SIGN`, `PINCH`, `OPEN_PALM`, `FIST`, `POINTING`, `CALL_ME`, `THREE`, `SPIDERMAN`

Each gesture has a unique hex color for the flash display and particle effects.

### The Three.js 4000-Particle Engine

The demo UI employs Three.js with a WebGL renderer for a "wow" factor visualization:

**Sphere Construction:**
- `4000` vertices placed on a golden-ratio sphere (radius `1.6`)
- `AdditiveBlending` particle material for glow effect
- `OrbitControls` for user camera rotation/zoom

**Particle Physics:**
When MediaPipe detects hands, fingertip positions are projected into 3D space. Every frame, all 4000 particles apply an inverse-square repulsive force:

```javascript
// Repulsion calculation (per particle, per fingertip)
const d = particle.distanceTo(fingertip3D);
if (d < 2.2) {
    const force = Math.pow(Math.max(0, 1 - d / 2.2), 2) * 0.9;
    // Push particle away from fingertip along the displacement vector
    particle.add(displacement.normalize().multiplyScalar(force));
}
```

| Physics Parameter | Value |
|:-----------------|:------|
| Repulsion radius | `2.2` units |
| Repulsion strength | `0.9` |
| Falloff | Inverse square: `(1 - d/2.2)²` |
| Trail particles | Spawned every 3rd frame for index + thumb only |
| Max trail count | `80` |
| Return force | Particles slowly drift back to original sphere position |

### UI Components

| Component | Description |
|:----------|:------------|
| **Top Bar** | Logo with typewriter animation, connection indicator (green/red), live FPS counter, hands detected counter |
| **Camera PiP** | Resizable camera panel with hand skeleton overlay drawn on `<canvas>`, expand/collapse toggle |
| **Info Panel** | Creator bio (typewriter animated), detected gesture display, finger state grid (THM/IDX/MID/RNG/PNK), scrolling event log, Start/Stop camera buttons |
| **Gesture Flash** | Full-screen typewriter text flash when a new gesture is detected, auto-hides after 1200ms |
| **Immersive Toggle** | Button to hide all UI panels for distraction-free particle viewing |

### Typewriter Engine

Custom `Typewriter` class in `app.js` handles all animated text:
- Character-by-character typing with `70ms` base speed + random jitter
- Backspace deletion at `30ms` per character
- Configurable pause between phrases (`1200ms` default)
- Supports `type()`, `wait()`, `clear()`, `loop()` chaining

## The FastAPI Server (`api/`)

The server is **optional** — useful for serving the web client locally and for WebSocket-based real-time streaming.

### Endpoints

| Endpoint | Method | Description |
|:---------|:-------|:------------|
| `/` | GET | Serves `web-client/index.html` |
| `/app.js` | GET | Serves the JavaScript bundle |
| `/style.css` | GET | Serves the CSS stylesheet |
| `/ws/hand-data` | WebSocket | Streams hand tracking JSON frames at ~30 FPS (throttled via `asyncio.sleep(0.033)`) |
| `/start` | POST | Starts headless hand tracker in a background thread |
| `/stop` | POST | Stops tracker and releases camera |
| `/status` | GET | Returns `{ running: bool, fps: float, connected_clients: int }` |
| `/press-key` | POST | Injects a keystroke: `{ "key": "A" }` → pynput |

### How to Run

```bash
# Option 1: Python server (serves web-client + enables WebSocket)
python main.py web          # Auto-opens browser to localhost:8765
python main.py server       # Server only (no auto-open)

# Option 2: Any static file server (web client runs standalone)
cd web-client && npx serve .
cd web-client && python -m http.server 3000

# Option 3: Vercel deployment (automatic via GitHub webhook)
# vercel.json routes all requests to web-client/
```

### Vercel Deployment

The `vercel.json` in the repo root configures automatic deployment:

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/", "destination": "/web-client/index.html" },
    { "source": "/(.*)", "destination": "/web-client/$1" }
  ]
}
```

All pushes to `main` that touch `web-client/` trigger an automatic Vercel deploy via GitHub webhook integration.
