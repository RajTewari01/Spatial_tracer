# Flutter Mobile Client & Android Native Integrations

The mobile application is a sovereign standalone ecosystem — it does **not** connect to the Python server. All camera processing, gesture detection, and OS control happens natively on-device via Kotlin.

## 1. System Architecture: Dart UI ↔ Kotlin Native

Running intensive AI frame extraction inside Flutter's single-threaded Dart Event Loop destroys frame rates. The architecture avoids the Dart layer entirely for processing:

```
Flutter (Dart UI)
    ↕ MethodChannel('com.rajtewari/hand_tracker')
    ↕ EventChannel('com.rajtewari/gesture_stream')
Kotlin Native Layer
    → TrackerService (LifecycleService + CameraX + MediaPipe)
    → GestureDetector (hand landmark classification)
    → FaceDetector (EAR blink + Z-depth tilt)
    → CursorOverlay (system overlay drawing)
    → SpatialAccessibilityService (OS-level tap/swipe injection)
```

### Flutter → Kotlin Bridge (`MainActivity.kt`, 85 lines)

**MethodChannel** (`com.rajtewari/hand_tracker`) handles:
- `startService(useHand: bool, useFace: bool)` — launches TrackerService with selected detectors
- `stopService()` — sends `STOP_SERVICE` action intent
- `checkOverlayPermission()` — checks `Settings.canDrawOverlays()`
- `openAccessibilitySettings()` — navigates to system accessibility settings

**EventChannel** (`com.rajtewari/gesture_stream`) provides:
- Live gesture name stream from Kotlin → Flutter (e.g., `"PEACE"`, `"FIST"`, `"TILT_UP"`)
- Used by the Flutter dashboard to show active gesture state in real-time

### Flutter Dart Layer (`lib/`)

| File | Size | Purpose |
|:-----|:-----|:--------|
| `main.dart` | 37 KB | App entry, onboarding flow (3-step tutorial with `hasSeenOnboarding` SharedPreferences gate), dashboard with toggle switches for Hand/Face tracking, settings panel, sidebar navigation |
| `theme.dart` | 3.6 KB | Dark/Light theme with emerald accent colors, glassmorphic card styles |
| `screens/creator_profile.dart` | 17 KB | Developer profile with glassmorphic cards, bio, social links, animated avatar |

### Flutter Dependencies (`pubspec.yaml`)

| Package | Purpose |
|:--------|:--------|
| `camera: ^0.11.0` | Camera preview in Flutter (used for onboarding tutorial) |
| `google_mlkit_commons: ^0.7.1` | Shared types for ML Kit (not used directly — Kotlin handles ML) |
| `permission_handler: ^11.4.0` | Runtime permission requests for camera, overlay |
| `google_fonts: ^8.0.2` | Typography (Inter, Outfit) |
| `shared_preferences: ^2.5.4` | Persisting `hasSeenOnboarding` flag |
| `url_launcher: ^6.3.2` | Opening external links (GitHub, etc.) |
| `provider: ^6.1.2` | State management for theme and tracking state |

## 2. TrackerService.kt (437 lines) — The Camera Engine

A `LifecycleService` (extends Android's Service with lifecycle awareness) that runs as a **Foreground Service** with persistent notification:

```kotlin
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
    startForeground(NOTIFICATION_ID, buildNotification(), 
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
}
```

### Camera Pipeline
1. Opens `CameraSelector.DEFAULT_FRONT_CAMERA` via CameraX
2. Sets `STRATEGY_KEEP_ONLY_LATEST` backpressure (drops old frames)
3. Output format: `OUTPUT_IMAGE_FORMAT_RGBA_8888` → `Bitmap` → `MPImage`
4. Timestamps use `SystemClock.uptimeMillis()` for strict monotonic ordering (prevents silent MediaPipe crashes)

### Frame Alternation (Dual-Model)

When both hand and face tracking are enabled, models alternate per-frame to prevent GPU overload:

```kotlin
frameCounter++
if (useHandTracking && useFaceTracking) {
    if (frameCounter % 2 == 0) {
        handLandmarker?.detectAsync(mpImage, timestampMs)
    } else {
        faceLandmarker?.detectAsync(mpImage, timestampMs)
    }
} else if (useHandTracking) {
    handLandmarker?.detectAsync(mpImage, timestampMs)
} else if (useFaceTracking) {
    faceLandmarker?.detectAsync(mpImage, timestampMs)
}
```

### EMA Cursor Smoothing (Kotlin)

```kotlin
private val SMOOTHING_FACTOR = 0.45f  // α = 0.45 (snappier than desktop's 0.6)

smoothedX = smoothedX + SMOOTHING_FACTOR * (targetX - smoothedX)
smoothedY = smoothedY + SMOOTHING_FACTOR * (targetY - smoothedY)
```

First frame snaps directly (`smoothedX == -1f` check). X-axis is mirrored (`1f - idx["x"]`) for front camera.

## 3. GestureDetector.kt (132 lines) — Hand Classification

A Kotlin `object` singleton using the same `tip.y < MCP.y` heuristic as the Python engine:

| Parameter | Value |
|:----------|:------|
| Pinch distance threshold | `< 0.05` (tighter than Python's `0.07`) |
| Peace tip gap | `> 0.05` (prevents false peace during pinch transition) |
| Thumbs up/down palm offset | `± 0.04` from palm center Y |
| Stable frames required | `2` |
| Gestures detected | 10: FIST, PINCH, THUMBS_UP, THUMBS_DOWN, MIDDLE_FINGER, PEACE, POINTING, ROCK, THREE, OPEN_PALM |

## 4. FaceDetector.kt — Blink & Tilt

| Detection | Method | Threshold | Stable Frames | Action |
|:----------|:-------|:----------|:--------------|:-------|
| BLINK | Eye Aspect Ratio (EAR) | `< 0.22` | 3 | Recent Apps |
| TILT_UP | `chin.z - forehead.z` | `< -0.045` | 3 | Scroll up (swipe down) |
| TILT_DOWN | `chin.z - forehead.z` | `> 0.045` | 3 | Scroll down (swipe up) |
| TILT_LEFT | `rightCheek.z - leftCheek.z` | `< -0.045` | 3 | Swipe right |
| TILT_RIGHT | `rightCheek.z - leftCheek.z` | `> 0.045` | 3 | Swipe left |

## 5. CursorOverlay.kt (103 lines) — System Drawing

Uses `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` to draw a cursor on top of all apps:

- **Flags:** `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE | FLAG_LAYOUT_IN_SCREEN` — invisible to touch events
- **Cursor design:** Dark ring border (24px) → white/blue fill (18px, blue on tap) → precise black dot center (4px)
- **Tap visual:** PEACE gesture swells cursor to 30px ring + 22px blue fill

## 6. SpatialAccessibilityService.kt (94 lines) — OS Control

The most critical Android component. Extends `AccessibilityService` to simulate physical touches:

### Tap Dispatch
```kotlin
val path = Path()
path.moveTo(px * screenWidth, py * screenHeight)
val stroke = GestureDescription.StrokeDescription(path, 0, 100)
val gesture = GestureDescription.Builder().addStroke(stroke).build()
dispatchGesture(gesture, null, null)
```

### System Navigation
```kotlin
performGlobalAction(GLOBAL_ACTION_BACK)     // PINCH gesture
performGlobalAction(GLOBAL_ACTION_HOME)     // THREE gesture
performGlobalAction(GLOBAL_ACTION_RECENTS)  // FIST gesture / BLINK
```

### Swipe Simulation (Head Tilts)
```kotlin
val swipePath = Path()
swipePath.moveTo(startX * sw, startY * sh)
swipePath.lineTo(endX * sw, endY * sh)
val stroke = StrokeDescription(swipePath, 0, 300)
dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
```

This enables hands-free TikTok/Instagram scrolling via head tilts.

### Android Cooldowns

| Action | Cooldown | Gesture |
|:-------|:---------|:--------|
| Tap | 600ms | PEACE |
| Back / Home / Recents | 1000ms | PINCH / THREE / FIST |
| Scroll (swipe) | 500ms | THUMBS_UP / THUMBS_DOWN |
| Blink action | 1500ms | BLINK (face) |
| Face tilt (scroll/swipe) | 1000ms | TILT_UP/DOWN/LEFT/RIGHT |
