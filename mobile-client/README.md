<div align="center">

# `Spatial_Tracer` Mobile Client

**Premium Android Vision Tracking Engine**

[![Flutter](https://img.shields.io/badge/Made%20with-Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![Kotlin](https://img.shields.io/badge/Kotlin-Native-7F52FF?style=flat-square&logo=kotlin&logoColor=white)](https://kotlinlang.org)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks-f472b6?style=flat-square&logo=google&logoColor=white)](https://mediapipe.dev)

*Control your Android device hands-free using AI Hand and Face tracking.*

</div>

---

## 🚀 Features

The Spatial_Tracer Mobile App is a highly optimized, dual-engine background tracking service that completely transforms how you interact with your phone.

### ✋ Hand Tracking (Air Gestures)
Built on `MediaPipe HandLandmarker`, this module provides a smooth on-screen cursor overlaid directly on your operating system, driven entirely by your hand.

*   **POINTING**: Move the cursor seamlessly (smoothed via Exponential Moving Average).
*   **PEACE SIGN**: Triggers a simulated touch/click on the screen at the cursor location.
*   **PINCH**: Acts as a "Back" button navigation.
*   **ALL-FINGERS-FOLDED (FIST)**: Opens the "Recent Apps" menu.

### 👁️ Face Tracking (Head & Eye Gestures)
Powered by `MediaPipe FaceLandmarker` and leveraging true 3D Z-Depth mapping, the Face module allows completely hand-free phone operation.

*   **TILT HEAD (UP/DOWN/LEFT/RIGHT)**: Mimics a physical swipe on the screen to scroll through social media apps, web pages, or lists.
*   **FIRM BLINK (EAR < 0.24)**: Opens the "Recent Apps" menu, allowing you to easily exit or minimize your current app hands-free.

### 💎 Premium App Aesthetics
*   **Glassmorphic UI**: High-end translucent iOS/Linux-inspired UI.
*   **Interactive Onboarding**: A beautiful tutorial flow that requires you to successfully cast the gestures in real-time to proceed.
*   **Sci-Fi Dashboard**: Live backend terminal logging, independent Hand/Face toggles, and responsive states.
*   **Dynamic Chinese Parallax Profile**: 3-layer parallax mirror-mountain creator profile.

---

## 🛠️ Architecture

Because the app must control the OS from the background, it aggressively utilizes native Android features.

### 1. The Flutter UI (`lib/`)
The front-end is written in completely responsive Dart/Flutter. It communicates with the background Android service via `MethodChannel` to start/stop the engines, and listens to real-time AI states via `EventChannel`.

### 2. The Native Kotlin Engine (`android/app/src/main/kotlin/`)
This is the core infrastructure:
*   `TrackerService.kt`: A `ForegroundService` that binds to `CameraX`. It reads raw camera buffers and alternatingly feeds them to the Hand and Face MediaPipe ML models to ensure smooth memory usage and battery efficiency.
*   `GestureDetector.kt` & `FaceDetector.kt`: The mathematical logic layers that convert raw `(x, y, z)` landmarks into discrete commands (e.g. `TILT_UP`, `FIST`).
*   `SpatialAccessibilityService.kt`: Plugs into Android's Accessibility APIs to cast the raw actions into physical OS-level touch injections (`performSwipe`, `GLOBAL_ACTION_BACK`, etc).
*   `CursorOverlay.kt`: Renders the high-FPS custom pointer cursor above all other apps (`TYPE_APPLICATION_OVERLAY`).

---

## ⚙️ Building and Installation

### Prerequisites
*   Flutter SDK `3.x`
*   Android Studio / SDK tools
*   An actual hardware device (Camera access and overlay permissions are required)

### Run locally
```bash
# Get dependencies
flutter pub get

# Connect your phone via USB debugging, then compile and run
flutter run --release
```

### Build APK
```bash
flutter build apk --release
# Installs directly to the connected device
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

---

## 🔐 Permissions
On first launch, the app requires:
1.  **Camera**: To pipe frames into the MediaPipe engines.
2.  **Display Over Other Apps**: To draw the cursor and run the tracker in the background.
3.  **Accessibility Services**: You must manually enable `Spatial Accessibility Service` in your phone's Settings > Accessibility menu to allow the app to actually tap and swipe for you.

---

*Part of the Spatial_Tracer ecosystem by [Biswadeep Tewari (RajTewari01)](https://github.com/RajTewari01)*
