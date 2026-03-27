# Code Audit: Truthfulness & Integrity Report

**Date:** March 2026 (Updated after full deep-code audit)  
**Scope:** All source files across Python engine, Kotlin native layer, and web client mapped against Wiki & README documentation.

## 1. Structural Accuracy (Verified ✅)

The core design paradigms documented in the `README.md` and `wiki/` were verified against active source code:

| Claim | Verification | Source Files |
|:------|:-------------|:-------------|
| MediaPipe 21-point hand map | ✅ Confirmed: landmarks `[0-20]` extracted in all 3 platforms | `headless_hand_tracer.py:114`, `GestureDetector.kt:7-27`, `app.js:30-33` |
| MediaPipe 478-point face map | ✅ Confirmed: FaceLandmarker used in Kotlin only | `TrackerService.kt:162-188` |
| Gestures without ML classifiers | ✅ Confirmed: `tip.y < MCP.y` / `tip.y > PIP.y` heuristics only | `air_input_driver.py:97-104`, `GestureDetector.kt:41-55`, `app.js` inline |
| Kotlin AccessibilityService fake touches | ✅ Confirmed: `GestureDescription.Builder` + `StrokeDescription(Path(), 0, 100)` | `SpatialAccessibilityService.kt` |
| Three.js 4000-particle sphere | ✅ Confirmed: 4000 vertices, radius 1.6, inverse-square repulsion | `app.js:1-8` header comment, sphere construction |
| Frame alternation (hand/face) | ✅ Confirmed: `frameCounter % 2` alternates detectors | `TrackerService.kt:216-227` |
| Desktop transparent overlay | ✅ Confirmed: `Qt.FramelessWindowHint \| Qt.WindowStaysOnTopHint \| Qt.Tool` + `WA_TranslucentBackground` | `app.py:309-314` |

## 2. Parameter Corrections (All Fixed)

During the deep audit, several floating-point parameters were found to differ between documentation, driver defaults, and actual runtime overrides:

| Parameter | Previous Doc Value | Driver Default | Actual Desktop Override | Kotlin Value | Status |
|:----------|:------------------|:---------------|:-----------------------|:-------------|:-------|
| **EMA Smoothing** | `α = 0.65` | `smoothing=0.35` (α=0.65) | `smoothing=0.4` (α=0.6) | `SMOOTHING_FACTOR=0.45` | ✅ Fixed — docs now show per-platform values |
| **Screen Margin** | `8%` | `margin=0.08` (8%) | `margin=0.1` (10%) | N/A (Kotlin uses full screen) | ✅ Fixed — docs now show both default and override |
| **Blink Threshold (EAR)** | `< 0.24` → corrected to `< 0.22` | N/A | N/A | `< 0.22` | ✅ Correct in current docs |
| **Face Stable Frames** | `2` | N/A | N/A | `3` | ✅ Correct — Hand=2, Face=3 |
| **Kotlin Pinch Threshold** | `< 0.07` | Python: `0.05` | N/A | `< 0.05` | ✅ Fixed — Kotlin is tighter than web |
| **Kotlin Stable Frames** | Not documented | N/A | N/A | `2` (was 3, reduced for snappiness) | ✅ Now documented |
| **Desktop Camera Resolution** | `640×480` | `1280×720` (driver default) | `640×480` (app.py override) | N/A | ✅ Fixed — both values shown |

## 3. Gesture→Action Mapping Corrections

The previous documentation showed generic mappings. Actual platform-specific actions differ significantly:

| Gesture | Desktop (Previous) | Desktop (Actual) | Android (Previous) | Android (Actual) |
|:--------|:------------------|:-----------------|:-------------------|:----------------|
| PEACE | Left click | Left click / double-click | Tap | Tap (600ms cooldown) |
| FIST | Right click ✅ | Right click ✅ | Recent apps | Recent Apps (1000ms) ✅ |
| PINCH | Drag start | Drag / left click | — | **Go Back** (1000ms) |
| THREE | — | **Tab key** | — | **Go Home** (1000ms) |
| THUMBS_UP | Scroll up | Scroll up + **Enter** | Volume up | **Swipe up** (500ms) |
| THUMBS_DOWN | Scroll down | Scroll down + **Backspace** | Volume down | **Swipe down** (500ms) |
| ROCK | — | **Escape key** | — | — |

## 4. Undocumented Features Discovered

| Feature | Location | Description |
|:--------|:---------|:------------|
| Virtual keyboard long-press | `app.py:628-656` | Holding PINCH on DEL/BACK for 4 seconds triggers Ctrl+A → Delete |
| Modifier stacking | `app.py:728-751` | SHIFT/CTRL/ALT held across next keypress, then auto-released |
| EventChannel gesture stream | `MainActivity.kt:70-80` | Live gesture names streamed from Kotlin → Flutter via EventChannel |
| Frame alternation | `TrackerService.kt:216-227` | `frameCounter % 2` prevents dual-model GPU overload |
| Camera PiP resize (web) | `index.html:29-31` | Toggle button to expand/collapse camera preview |
| Immersive mode (web) | `index.html:121-125` | Hide all UI panels for clean particle visualization |

**Conclusion:** All documentation is now verified against source code. Per-platform parameter differences are explicitly documented. No false claims remain.
