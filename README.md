<div align="center">

# `Spatial_Tracer`

**Vision Tracking Engine — Air Gesture Control System**

[![MIT License](https://img.shields.io/badge/License-MIT-7c6aff?style=flat-square)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-34d399?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flutter 3.x](https://img.shields.io/badge/Flutter-3.x-22d3ee?style=flat-square&logo=flutter&logoColor=white)](https://flutter.dev)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-f472b6?style=flat-square&logo=google&logoColor=white)](https://mediapipe.dev)

*Control your computer and phone with nothing but your hands.*
*No hardware. No gloves. Just a camera.*

---

</div>

## What is Spatial_Tracer?

Spatial\_Tracer is a multi-platform air gesture engine that turns your hand movements into real input — mouse cursor control, clicks, keystrokes, and scrolling — using only a standard webcam or phone camera.

It ships as three clients:

| Platform | Stack | What It Does |
|----------|-------|-------------|
| **Web** | MediaPipe JS · Three.js | In-browser gesture demo with 3D particle visualization |
| **Desktop** | PyQt5 · pynput · MediaPipe Tasks | Transparent overlay + Virtual Keyboard for air-typing |
| **Android** | Flutter · Kotlin · MediaPipe Tasks | Mobile gesture recognition with camera feed |

---

## Architecture

```mermaid
graph TB
    subgraph Input["Input Layer"]
        CAM["Camera Feed"]
    end

    subgraph Engine["Processing Engine"]
        MP["MediaPipe Hand Landmarker"]
        GD["Gesture Detector - 13 Gestures"]
        AID["Air Input Driver - OS Control"]
    end

    subgraph Output["Output Layer"]
        MOUSE["Mouse: Move, Click, Scroll"]
        KBD["Keyboard: Enter, Back, Tab, Esc"]
        VIZ["3D Particle Visualization"]
    end

    CAM --> MP
    MP -->|"21 Landmarks"| GD
    GD -->|"Gesture Events"| AID
    AID --> MOUSE
    AID --> KBD
    GD --> VIZ
```

---

## System Flow

```mermaid
sequenceDiagram
    participant C as Camera
    participant MP as MediaPipe
    participant GD as GestureDetector
    participant D as AirInputDriver
    participant OS as OperatingSystem

    C->>MP: Video Frame at 30fps
    MP->>GD: 21 Hand Landmarks x y z
    GD->>GD: Finger State Analysis
    GD->>GD: 2-Frame Stability Buffer
    GD->>D: Gesture Event

    alt POINTING
        D->>OS: Move mouse cursor with EMA smoothing
    else PINCH
        D->>OS: Left click
    else PEACE
        D->>OS: Double click
    else FIST
        D->>OS: Right click
    else THUMBS UP
        D->>OS: Press Enter key
    else SWIPE
        D->>OS: Scroll 3 lines
    end
```

---

## Gesture Map

```
┌─────────────────────────────────────────────────────────┐
│  GESTURE          │  ACTION            │  COLOR         │
├───────────────────┼────────────────────┼────────────────┤
│  POINTING         │  Move cursor       │  ● #34d399     │
│  PINCH            │  Left click        │  ● #fbbf24     │
│  PEACE            │  Double click      │  ● #7c6aff     │
│  FIST             │  Right click       │  ● #ef4444     │
│  THUMBS UP        │  Enter key         │  ● #34d399     │
│  THUMBS DOWN      │  Backspace key     │  ● #f472b6     │
│  THREE            │  Tab key           │  ● #a393ff     │
│  ROCK             │  Escape key        │  ● #fbbf24     │
│  OPEN PALM        │  Idle / Release    │  ● #22d3ee     │
│  OK SIGN          │  OK gesture        │  ● #38bdf8     │
│  MIDDLE FINGER    │  Middle finger     │  ● #fb923c     │
│  CALL ME          │  Call me           │  ● #22d3ee     │
│  SPIDERMAN        │  Spiderman         │  ● #f472b6     │
└───────────────────┴────────────────────┴────────────────┘
```

---

## ✨ Virtual Keyboard (Desktop)

The desktop client includes a **premium glassmorphic virtual keyboard** that you can type on using gestures in mid-air.

| Feature | Description |
|---------|-------------|
| **Two-Hand Tracking** | Use both hands simultaneously. Hold `SHIFT` or `CTRL` with one hand and type a letter with the other (`Ctrl+C`, etc). |
| **Hover & Target** | Pointing (`PEACE` or `POINTING` gesture) moves a glowing finger cursor over the keys. |
| **Air-Typing** | `PINCH` a key to type it (features a visual flash and cooldown to prevent double-typing). |
| **Quick Clear** | `PINCH` and hold the `DEL` or `BACKSPACE` key for **4 seconds** to trigger a `Ctrl+A` → `Delete` macro, clearing all text instantly. |

---

## Gesture Detection Pipeline

```mermaid
flowchart LR
    subgraph Detect["Finger State"]
        A["isExtended fn"] --> B["Tip.y below MCP.y"]
        C["isFolded fn"] --> D["Tip.y above PIP.y"]
    end

    subgraph Classify["Gesture Classification"]
        B --> E{"Pattern Match"}
        D --> E
        E -->|"idx up, rest down"| F["POINTING"]
        E -->|"thumb-index close"| G["PINCH"]
        E -->|"idx+mid up, rest down"| H["PEACE"]
        E -->|"all down"| I["FIST"]
        E -->|"all up"| J["OPEN PALM"]
    end

    subgraph Stable["Stability"]
        F --> K["2-Frame Buffer"]
        G --> K
        H --> K
        I --> K
        J --> K
        K --> L["Emit Gesture"]
    end
```

---

## Project Structure

```
spatial_tracer/
│
├── engine/                          # Core processing
│   ├── headless_hand_tracer.py      # MediaPipe Tasks API tracker
│   ├── simple_hand_tracer.py        # OpenCV debug view with skeleton
│   ├── gesture_detector.py          # Pinch, tap, swipe, palm detection
│   └── air_input_driver.py          # pynput mouse/keyboard control
│
├── api/                             # Server layer
│   ├── fastapi_main.py              # FastAPI + WebSocket server
│   └── input_controller.py          # Keyboard input via pynput
│
├── web-client/                      # Browser client
│   ├── index.html                   # Premium dark UI
│   ├── style.css                    # Pitch-black dev theme
│   └── app.js                       # MediaPipe JS + Three.js + gestures
│
├── desktop-client/                  # PyQt5 overlay
│   ├── app.py                       # Transparent overlay + camera panel
│   └── camera_widget.py             # Hand skeleton renderer
│
├── mobile-client/                   # Flutter Android
│   ├── lib/main.dart                # Full app (camera, gestures, UI)
│   ├── android/.../MainActivity.kt  # MediaPipe Kotlin platform channel
│   └── pubspec.yaml                 # Dependencies
│
├── config/
│   ├── hand_landmarker.task         # MediaPipe model weights
│   └── mapping.json                 # Key mapping config
│
├── main.py                          # CLI entry point
├── requirement.txt                  # Python dependencies
└── LICENSE                          # MIT
```

---

## Multi-Platform Architecture

```mermaid
graph LR
    subgraph Web["Web Client"]
        W1["MediaPipe JS in-browser"]
        W2["Three.js 4000 Particles"]
        W3["Gesture Tags + Event Log"]
    end

    subgraph Desktop["Desktop Client"]
        D1["HeadlessHandTracker in-process"]
        D2["AirInputDriver via pynput"]
        D3["PyQt5 Overlay + Camera Panel"]
    end

    subgraph Mobile["Mobile Client"]
        M1["Kotlin MediaPipe platform channel"]
        M2["Dart Gesture Detection"]
        M3["Flutter UI + Skeleton Painter"]
    end

    subgraph Shared["Shared Gesture Engine"]
        S1["Gesture Logic - same algorithm"]
        S2["13 Gestures MCP-based"]
    end

    S1 -.->|"Dart port"| M2
    S1 -.->|"JS port"| W1
    S1 -.->|"Python"| D1
```

---

## Quick Start

### Prerequisites

```bash
Python 3.10+
Flutter 3.x (for mobile)
Webcam / Camera
```

### Install

```bash
git clone https://github.com/RajTewari01/Spatial_tracer.git
cd Spatial_tracer
pip install -r requirement.txt
```

### Run

```bash
# Web client — open in browser with 3D particle demo
python main.py web

# Desktop — transparent overlay, real mouse/keyboard control
python main.py desktop

# Debug — OpenCV window with hand skeleton
python main.py debug

# Android — Flutter app
cd mobile-client && flutter run
```

---

## Tech Stack

```mermaid
mindmap
  root((Spatial_Tracer))
    Vision
      MediaPipe Hands
      Hand Landmarker
      21 Landmarks
    Backend
      FastAPI
      WebSocket
      Uvicorn
    Desktop
      PyQt5
      pynput
      OpenCV
    Web
      Three.js
      MediaPipe JS
      Canvas API
    Mobile
      Flutter
      Kotlin
      Camera Plugin
    AI/ML
      TensorFlow Lite
      Hand Detection
      Gesture Classification
```

---

## Gesture Detection — How It Works

The system uses a **two-phase approach**:

### Phase 1: Finger State Analysis

Each of the 5 fingers is classified independently:

| State | Condition | Description |
|-------|-----------|-------------|
| **Extended** | `tip.y < MCP.y` | Fingertip is above its knuckle |
| **Folded** | `tip.y > PIP.y` | Fingertip is below its middle joint |
| **Ambiguous** | Between | Partially bent — ignored to prevent false triggers |

For the **thumb**, lateral distance from the index MCP is used instead of Y-axis comparison.

### Phase 2: Pattern Matching with Priority

Gestures are checked **most-specific first**. If a specific gesture matches (like PEACE), the catch-all gestures (FIST, OPEN_PALM) are **blocked** from firing. This prevents the domination problem where generic gestures override specific ones.

A **2-frame stability buffer** prevents single-frame noise from triggering false gestures.

---

## Desktop Air Input — How Mouse Control Works

```mermaid
flowchart LR
    A["Index Fingertip normalized 0-1"] --> B["Margin Mapping 0.1 dead zone"]
    B --> C["Screen Mapping 1920x1080"]
    C --> D["EMA Smoothing alpha 0.6"]
    D --> E["pynput mouse position"]
```

- **Smoothing**: Exponential Moving Average prevents cursor jitter
- **Margin**: 10% dead zone at screen edges for comfortable use
- **Cooldowns**: 400ms click, 150ms scroll, 500ms key — prevents accidental repeats

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `smoothing` | `0.4` | Cursor smoothing (0=raw, 1=frozen) |
| `margin` | `0.1` | Screen edge dead zone |
| `click_cooldown` | `0.4s` | Min time between clicks |
| `scroll_cooldown` | `0.15s` | Min time between scrolls |
| `key_cooldown` | `0.5s` | Min time between key presses |
| `modelComplexity` | `0` | MediaPipe model (0=fast, 1=accurate) |
| `maxNumHands` | `2` | Max hands to track |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the web client |
| `/ws/hand-data` | WebSocket | Real-time hand landmark stream |
| `/status` | GET | Server status + active connections |

---

## Contributing

```bash
# Fork → Clone → Branch → Code → PR
git checkout -b feat/your-feature
# Make changes
git commit -m "feat: description"
git push origin feat/your-feature
```

---

## Roadmap

- [ ] Voice commands integration
- [ ] Multi-hand collaborative gestures
- [ ] Custom gesture training (record your own)
- [ ] Accessibility mode for motor-impaired users
- [ ] iOS Flutter client
- [ ] Electron desktop app

---

<div align="center">

**Built by [Biswadeep Tewari](https://github.com/RajTewari01)**

*Full-Stack & AI/ML Engineer · Python · Dart · Kotlin · JS*
*MAKAUT University, West Bengal*

`build > ship > learn > repeat`

---

MIT License · 2025-2026

</div>
