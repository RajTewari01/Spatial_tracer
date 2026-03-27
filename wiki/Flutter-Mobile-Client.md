# Flutter Mobile Client & Android Native Integrations

The mobile application acts as a sovereign ecosystem for Spatial_Tracer, built primarily to function as an invisible accessibility background service.

## 1. System Architecture: Dart meets Kotlin

Running intensive AI frame extraction inside Flutter's single-threaded Dart Event Loop is catastrophic for frame rates. We avoid the Dart layer entirely for processing.

### The Background Foreground Service
When the user clicks "Start Engine" in the Flutter UI, a `MethodChannel` calls out to Kotlin. 
The Kotlin code launches an Android `Foreground Service` (represented by a persistent Android notification). This forces Android's battery-management systems to keep the camera pipe open indefinitely even if the app UI is thoroughly destroyed from RAM.

```kotlin
// Android/Kotlin Foreground Service Execution Snippet
val notification = NotificationCompat.Builder(this, CHANNEL_ID)
    .setContentTitle("Spatial Tracer Active")
    .setContentText("Listening for air gestures...")
    .setSmallIcon(R.mipmap.ic_launcher)
    .build()

startForeground(SERVICE_ID, notification)
```

## 2. MediaPipe Task Vision in Kotlin

Inside this foreground service, we instantiate `HandLandmarker` and `FaceLandmarker` clients via Google's `com.google.mediapipe:tasks-vision` SDK.
*   **Alternating Frames**: To keep our inference times under `30ms` on cheap hardware, we *interleave* the models. Frame 1 executes Face tracking. Frame 2 executes Hand tracking. They never clash on the same CPU core simultaneously.

## 3. The Android Accessibility Service

This is the most critical and complex part of the mobile logic. Operating systems strictly sandbox apps from touching other apps. However, Android provides the `AccessibilityService` API for motor-impaired users to simulate touches.

### Dispatching Global Actions
When the Kotlin inference loop determines that a `FIST` gesture has occurred, it sends a broadcast `Intent` to our `AccessibilityService` receiver. The service then executes a native system call:

```kotlin
// Triggering Recent Apps via Accessibility Service
performGlobalAction(GLOBAL_ACTION_RECENTS)
```

### Dispatching Swipe Physics (Head Tilts)
When the face tracker detects a Z-depth pitch (the user tilted their head down), we cannot simply use a global action. We must simulate a fluid `GestureDescription` across the screen canvas to spoof a physical finger drag.

```kotlin
// Path construction for an automated swipe simulated by head movements
val swipePath = Path()
swipePath.moveTo(screenWidth / 2, screenHeight * 0.8f) // Starting bottom
swipePath.lineTo(screenWidth / 2, screenHeight * 0.2f) // Drag to top

val gestureBuilder = GestureDescription.Builder()
gestureBuilder.addStroke(StrokeDescription(swipePath, 0, 300))
dispatchGesture(gestureBuilder.build(), null, null)
```

This effectively maps invisible head movements into perfect TikTok / Instagram Reels infinite scrolls.
