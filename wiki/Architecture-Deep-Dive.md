# Architecture Deep Dive

Spatial_Tracer is built as a unified vision engine powering three distinct user experiences (Web, Desktop, Mobile). At its core, it relies on high-frequency coordinate mathematics to translate raw 2D and 3D camera vectors into actionable human intent — no gloves, no hardware, no ML classifiers.

## The Two-Phase Pipeline

### Phase 1: Spatial Geometry Extraction and Normalization

The `MediaPipe Task Vision` models output spatial data in normalized dimensional space `[0.0, 1.0]` relative to the camera frame.

#### Hand Landmarks (21 points)
A single hand provides 21 nodes. The crucial nodes for our kinematics engine:

| ID | Landmark | Role |
|:---|:---------|:-----|
| `0` | WRIST | Anchoring and global positioning |
| `4` | THUMB_TIP | Thumb extension detection (X-axis lateral comparison) |
| `8` | INDEX_TIP | Primary pointing cursor, tap detection |
| `12` | MIDDLE_TIP | Peace sign partner, middle finger detection |
| `16` | RING_TIP | Three-finger and open palm component |
| `20` | PINKY_TIP | Rock sign, call-me, open palm component |

**Joint References:**
- `MCP` (Metacarpophalangeal) — knuckle joints: `[2, 5, 9, 13, 17]`
- `PIP` (Proximal Interphalangeal) — mid-finger joints: `[3, 6, 10, 14, 18]`
- `TIP` — fingertips: `[4, 8, 12, 16, 20]`

**Finger State Calculation (Deterministic — No ML):**

```python
# Finger extension: tip is physically above knuckle (lower Y in image space)
def is_extended(lm, finger_index):
    if finger_index == 0:  # Thumb uses X-axis (lateral distance)
        ref_x = lm[INDEX_MCP].x
        return abs(lm[THUMB_TIP].x - ref_x) > abs(lm[THUMB_IP].x - ref_x)
    return lm[TIP[finger_index]].y < lm[MCP[finger_index]].y

# Finger folded: tip is below its own mid-joint
def is_folded(lm, finger_index):
    if finger_index == 0:  # Thumb inverse of extended
        ref_x = lm[INDEX_MCP].x
        return abs(lm[THUMB_TIP].x - ref_x) < abs(lm[THUMB_IP].x - ref_x)
    return lm[TIP[finger_index]].y > lm[PIP[finger_index]].y
```

This identical algorithm is implemented in:
- **Python**: `engine/air_input_driver.py` (`_is_extended`, `_is_folded`)
- **Kotlin**: `GestureDetector.kt` (`isExtended`, `isFolded`)
- **JavaScript**: `web-client/app.js` (inline functions)

#### Face Landmarks (478 points)
Face processing (Android only) calculates:

1. **Head Tilt (Z-Depth Pose Estimation):**
   - *Pitch:* `tilt = chin.z - forehead.z` — if `|tilt| > 0.045` for 3 stable frames → TILT_UP or TILT_DOWN
   - *Yaw:* `yaw = rightCheek.z - leftCheek.z` — if `|yaw| > 0.045` for 3 stable frames → TILT_LEFT or TILT_RIGHT

2. **Eye Aspect Ratio (EAR) — Blink Detection:**
   EAR = vertical eye landmark distance / horizontal eye landmark distance
   - Threshold: `EAR < 0.22` sustained for **3 consecutive frames** = BLINK trigger
   - Action: Opens Recent Apps menu (via `performGlobalAction(GLOBAL_ACTION_RECENTS)`)

### Phase 2: Heuristics, Smoothing, and Command Dispatch

Once atomic finger states are evaluated, Phase 2 maps them into **13 Actionable Gestures**: `POINTING`, `PEACE`, `FIST`, `PINCH`, `OPEN_PALM`, `THUMBS_UP`, `THUMBS_DOWN`, `ROCK`, `OK`, `CALL_ME`, `THREE`, `SPIDERMAN`, `MIDDLE_FINGER`.

#### Gesture→Action Mapping (Platform-Specific)

| Gesture | Desktop (Python + pynput) | Android (Kotlin + AccessibilityService) |
|:--------|:--------------------------|:---------------------------------------|
| POINTING | Move cursor (EMA smoothed) | Move overlay cursor |
| PEACE | Left click / double-click | Tap at cursor position (600ms cooldown) |
| FIST | Right click | Recent Apps (1000ms cooldown) |
| PINCH | Drag start / left click | Go Back (1000ms cooldown) |
| THREE | Tab key | Go Home (1000ms cooldown) |
| THUMBS_UP | Scroll up / Enter | Swipe up (500ms cooldown) |
| THUMBS_DOWN | Scroll down / Backspace | Swipe down (500ms cooldown) |
| ROCK | Escape key | — |
| OPEN_PALM | Idle / release | Idle |

#### Jitter Prevention via Exponential Moving Average (EMA)

Vision AI naturally jitters 1–3px per frame even when hands are steady. EMA formula:

```
smoothed = previous + α × (raw - previous)
```

where `α` is calculated as `1.0 - smoothing_factor`:

| Platform | Smoothing Factor | α (Responsiveness) | Code Location |
|:---------|:----------------|:-------------------|:--------------|
| Desktop (override) | `0.4` | `0.6` | `desktop-client/app.py:75` |
| Desktop (driver default) | `0.35` | `0.65` | `engine/air_input_driver.py:47` |
| Android (Kotlin) | `0.45` | `0.45` | `TrackerService.kt:56` |

#### The Frame Stability Buffer

A user transitioning from `OPEN_PALM` to `FIST` might technically form `PINCH` for 1 frame as the hand closes. To prevent misfires:

- **Hand gestures:** Must be identical for `N = 2` contiguous frames before triggering (all platforms)
- **Face gestures:** Must be identical for `N = 3` contiguous frames before triggering (Android only)
- **Temporal cooldowns** prevent repeat-fire:

| Platform | Click | Scroll | Key Press | Gesture | Blink |
|:---------|:------|:-------|:----------|:--------|:------|
| Desktop | 400ms | 150ms | 500ms | — | — |
| Android | 600ms (tap) | 500ms (swipe) | — | 1000ms | 1500ms |
| Web | — | — | — | 1200ms (flash) | — |

#### Frame Alternation (Android Only)

When both hand tracking and face tracking are enabled simultaneously, TrackerService alternates models per-frame to prevent GPU overload on constrained mobile hardware:

```kotlin
// TrackerService.kt:216-227
if (useHandTracking && useFaceTracking) {
    if (frameCounter % 2 == 0) {
        handLandmarker?.detectAsync(mpImage, timestampMs)
    } else {
        faceLandmarker?.detectAsync(mpImage, timestampMs)
    }
}
```

This halves the effective FPS per detector but prevents MediaPipe timestamp collisions and thermal throttling.
