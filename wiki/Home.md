# Spatial_Tracer Wiki Home

Welcome to the official developer Wiki for **Spatial_Tracer**, a multi-platform air gesture control engine. This Wiki serves as the comprehensive source of truth for the codebase, architecture, CI/CD integrations, and mathematical breakdown of our gesture detection system.

## Navigation

* **[Architecture Deep Dive](Architecture-Deep-Dive.md)**
  * Details the overall multi-component architecture.
  * Explains the mathematical geometry behind our vision processing.
* **[Python Engine & Desktop Application](Python-Engine-&-Desktop.md)**
  * Details how the underlying Python `engine/` translates AI vectors into OS commands.
  * Explains the PyQt5 desktop client and virtual glassmorphic keyboard.
* **[Flutter Mobile Client](Flutter-Mobile-Client.md)**
  * Outlines the Android architecture, Kotlin native bindings to MediaPipe, and Dart interface.
  * Details Face Tracking (Z-Depth/EAR) and Android Accessibility Service inputs.
* **[Web Client & API Reference](Web-Client-&-API.md)**
  * Documents the FastAPI layer, WebSockets, and Three.js visualizer.
* **[CI/CD Workflows](CI-CD-Workflows.md)**
  * Thorough explanation of our GitHub Actions, build steps, and automated pipelines.
