# Spatial_Tracer Wiki Home

Welcome to the official developer Wiki for **Spatial_Tracer**, a multi-platform air gesture control engine. This Wiki is the comprehensive source of truth for the codebase, architecture, CI/CD pipelines, and mathematical breakdown of the gesture detection system.

## Navigation

* **[Architecture Deep Dive](Architecture-Deep-Dive.md)**
  * Two-phase pipeline: geometry extraction → heuristic gesture classification
  * Mathematical formulas: EMA smoothing, EAR blink detection, Z-depth tilt
  * Per-platform gesture→action mapping tables
  * Frame stability buffer and temporal cooldown system
  * Frame alternation strategy for dual-model Android inference

* **[Python Engine & Desktop Application](Python-Engine-&-Desktop.md)**
  * Headless inference engine (`headless_hand_tracer.py`, `gesture_detector.py`, `air_input_driver.py`)
  * FastAPI server + WebSocket streaming protocol
  * PyQt5 transparent overlay (814-line `app.py`)
  * Virtual keyboard interaction model (PINCH to type, modifier stacking, long-press)
  * Cursor mapping pipeline with EMA smoothing (α=0.6)

* **[Flutter Mobile Client](Flutter-Mobile-Client.md)**
  * Dart↔Kotlin bridge via MethodChannel + EventChannel
  * TrackerService lifecycle (LifecycleService + CameraX + MediaPipe LIVE_STREAM)
  * GestureDetector.kt (10 gestures, `tip.y < MCP.y` deterministic heuristic)
  * FaceDetector.kt (EAR < 0.22 blink, Z-depth ±0.045 tilt)
  * CursorOverlay (TYPE_APPLICATION_OVERLAY system drawing)
  * SpatialAccessibilityService (GestureDescription.Builder for fake touches)

* **[Web Client & API Reference](Web-Client-&-API.md)**
  * Browser-only MediaPipe WASM — zero backend required
  * Three.js 4000-particle sphere with inverse-square repulsion physics
  * 13-gesture detection in vanilla JavaScript
  * FastAPI endpoints and WebSocket frame format
  * Vercel deployment configuration

* **[CI/CD Workflows](CI-CD-Workflows.md)**
  * GitHub Actions: Python engine (flake8), Flutter mobile (analyze + APK), Web client (jshint)
  * Runner selection rationale (Windows for Python, Ubuntu for Flutter/Web)
  * Artifact outputs and Vercel webhook integration

* **[Integrity Report](Integrity-Report.md)**
  * Line-by-line code audit mapping documentation claims → source files
  * Parameter correction log (EMA alpha, margins, thresholds, cooldowns)
  * Undocumented features catalog
