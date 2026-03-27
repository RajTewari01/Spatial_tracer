# Architecture Deep Dive

Spatial_Tracer is built as a unified vision engine powering three distinct user experiences (Web, Desktop, Mobile). At its core, it relies heavily on high-frequency coordinate mathematics to translate raw 2D and 3D camera vectors into actionable human intent without the need for gloves or hardware sensors.

## The Two-Phase Pipeline

### Phase 1: Spatial Geometry Extraction and Normalization

The `MediaPipe Task Vision` models are the foundation of our AI perception. They output spatial data in normalized dimensional space `[0.0, 1.0]` relative to the frame.

#### Hand Landmarks (21 points)
A single hand provides 21 nodes. The crucial nodes for our kinematics engine are:
*   `0`: WRIST (Anchoring and global positioning)
*   `4`: THUMB_TIP
*   `8`: INDEX_FINGER_TIP
*   `12`: MIDDLE_FINGER_TIP
*   `16`: RING_FINGER_TIP
*   `20`: PINKY_TIP

**Finger State Calculation (Folded vs. Extended):**
We do not use standard machine learning classification models to detect gestures like "Peace" or "Pinch". Instead, we use a highly optimized deterministic state machine relying on the `y` positions of fingertips relative to their corresponding metacarpophalangeal (MCP) and proximal interphalangeal (PIP) joints.

```python
# Pseudo-code for deterministic finger extension check
def is_finger_up(tip_y, mcp_y, pip_y):
    # If the tip is physically higher (lower y-value in image space)
    # than the main knuckle (MCP), the finger is considered "extended".
    return tip_y < mcp_y
```

#### Face Landmarks (478 points)
Face processing calculates deeply granular movements:
1.  **Head Tilt (Pose Estimation):** We infer pitch and yaw by analyzing the relative `Z-depth` differentials between the `NOSE_TIP`, `LEFT_CHEEK`, and `RIGHT_CHEEK`.
    *   *Pitch Math:* `pitch = (nose.z - (left_cheek.z + right_cheek.z)/2) * scalar`
2.  **Eye Aspect Ratio (EAR):** To invoke non-vocal, non-manual commands (like minimizing apps), we analyze the EAR.
    *   *EAR Formula:* The Euclidean distance between vertical eye landmarks divided by the horizontal eye landmarks. An EAR `< 0.22` registered across 3 consecutive frames acts as a secure "Blink Trigger".

### Phase 2: Heuristics, Smoothing, and Command Dispatch

Once the atomic states (e.g., "Index extended, Middle extended, all others folded") are evaluated, Phase 2 maps these into **Actionable Gestures** (`POINTING`, `PINCH`, `PEACE`, `FIST`, `OPEN_PALM`).

#### Jitter Prevention via Exponential Moving Average (EMA)
Vision AI naturally jitters by 1-3 pixels per frame even when hands are perfectly still. To make OS cursor movement feasible, we implement EMA:

```javascript
// EMA Smoothing Algorithm
const ALPHA = 0.65; // High alpha = faster response, low alpha = smoother movement
let smoothedX = (rawX * ALPHA) + (previousX * (1 - ALPHA));
let smoothedY = (rawY * ALPHA) + (previousY * (1 - ALPHA));
```

#### The Frame Stability Buffer
A user transitioning from `OPEN_PALM` to `FIST` might technically form a `PINCH` gesture for exactly 1 frame as their hand closes. Attempting actions on frame 1 causes misfires.
To solve this, our engine utilizes a **Frame Stability Buffer**:
*   A gesture must be identical for `N = 2` contiguous frames to be acknowledged.
*   Once a discrete action (e.g. `Click`) is fired, a **Temporal Cooldown** of `400ms` begins, ignoring further click requests to prevent double-clicking from lingering.
