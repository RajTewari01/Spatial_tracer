# CI/CD Workflows & Deployment Infrastructure

Spatial_Tracer employs three GitHub Actions workflows plus a Vercel webhook for continuous deployment. Each workflow is path-scoped — it only triggers when files in its domain are modified, preventing unnecessary builds.

## Pipeline Overview

```
Push / PR to main
├── engine/ api/ desktop-client/ main.py requirements.txt
│   └── Python Engine CI (windows-latest)
│       └── flake8 syntax + complexity lint
│
├── mobile-client/
│   └── Flutter Mobile CI (ubuntu-latest)
│       ├── flutter analyze
│       ├── flutter build apk --release
│       └── Upload APK artifact
│
├── web-client/
│   ├── Web Client CI (ubuntu-latest)
│   │   ├── jshint lint
│   │   ├── File integrity check
│   │   └── Upload web-client artifact
│   └── Vercel Webhook (automatic deploy)
```

---

## 1. Python Engine CI (`python-engine.yml`)

**Runner:** `windows-latest`  
**Why Windows?** The engine uses `pynput` and `ctypes.windll.user32` for OS-level mouse/keyboard control. These are Windows-only APIs — running on `ubuntu-latest` would cause import failures during linting because `pywin32` and Windows DLLs don't exist on Linux.

### Trigger Paths
```yaml
paths:
  - 'engine/**'
  - 'api/**'
  - 'desktop-client/**'
  - 'main.py'
  - 'requirements.txt'
  - '.github/workflows/python-engine.yml'
```

### Steps

| Step | Action | Details |
|:-----|:-------|:--------|
| Checkout | `actions/checkout@v4` | Shallow clone of the repo |
| Python Setup | `actions/setup-python@v5` | Python 3.10 with `pip` caching enabled |
| Install Deps | `pip install flake8` + `requirements.txt` | Installs all runtime deps (opencv, mediapipe, pyqt5, pynput, fastapi, etc.) so imports resolve during lint |
| **Lint (fatal)** | `flake8 --select=E9,F63,F7,F82` | **Fails the build** on syntax errors, undefined names, invalid escape sequences |
| **Lint (advisory)** | `flake8 --exit-zero --max-complexity=10 --max-line-length=127` | Reports warnings but does **not** fail the build |

### Exclusion Directories
Both lint passes exclude directories that aren't Python engine code:
```
--exclude=mobile-client,web-client,wiki,vision_tracker,venv,.venv,env,Lib,Scripts
```
This prevents false positives from Flutter/Dart files, web JavaScript, virtual environment internals, and the legacy `vision_tracker/` directory.

### flake8 Error Codes

| Code | Meaning | Severity |
|:-----|:--------|:---------|
| `E9` | Runtime syntax errors (SyntaxError, IndentationError) | 🔴 Build-breaking |
| `F63` | Invalid `__all__` usage, assertion against tuple | 🔴 Build-breaking |
| `F7` | Undefined variable or statement issues | 🔴 Build-breaking |
| `F82` | Undefined name in `__all__` | 🔴 Build-breaking |
| All others | Style warnings (line length, whitespace, complexity) | 🟡 Advisory only |

---

## 2. Flutter Mobile CI (`flutter-mobile.yml`)

**Runner:** `ubuntu-latest`  
**Why Ubuntu?** Flutter's Android build toolchain (Gradle, Android SDK, Java) works identically on Linux and is significantly faster than Windows runners. The Kotlin native code compiles via Gradle regardless of host OS.

### Trigger Paths
```yaml
paths:
  - 'mobile-client/**'
  - '.github/workflows/flutter-mobile.yml'
```

### Steps

| Step | Action | Details |
|:-----|:-------|:--------|
| Checkout | `actions/checkout@v4` | Full repo clone |
| Java Setup | `actions/setup-java@v3` | Zulu OpenJDK 17 (required by Gradle 8.x) |
| Flutter Setup | `subosito/flutter-action@v2` | Flutter 3.x stable channel, with SDK caching |
| Install Deps | `flutter pub get` | Resolves all packages from `pubspec.yaml` |
| **Analyze** | `flutter analyze --no-fatal-infos --no-fatal-warnings` | Runs the Dart analyzer. Info-level and warning-level issues do **not** fail the build — only errors do. This prevents CI breakage from non-critical lints like `prefer_const_constructors`. |
| **Build APK** | `flutter build apk --release` | Full release build with Gradle: R8 shrinking, Kotlin compilation, ProGuard obfuscation, tree shaking. Produces `app-release.apk`. |
| **Upload Artifact** | `actions/upload-artifact@v4` | Uploads the APK as `release-apk` — downloadable from the Actions run page for QA testing |

### APK Output Path
```
mobile-client/build/app/outputs/flutter-apk/app-release.apk
```

### Build Requirements (resolved automatically by CI)
- **Java 17** — Required by Android Gradle Plugin 8.x
- **Flutter 3.x** — Dart SDK ^3.11.0 (from `pubspec.yaml`)
- **Android SDK** — Bundled with Flutter action; `minSdkVersion 24`, `targetSdkVersion 34`

---

## 3. Web Client CI (`web-client.yml`)

**Runner:** `ubuntu-latest`  
**Why Ubuntu?** Pure file validation — no OS-specific dependencies needed.

### Trigger Paths
```yaml
paths:
  - 'web-client/**'
  - '.github/workflows/web-client.yml'
```

### Steps

| Step | Action | Details |
|:-----|:-------|:--------|
| Checkout | `actions/checkout@v4` | Full repo clone |
| Node.js Setup | `actions/setup-node@v4` | Node.js 20 |
| **JS Lint** | `jshint app.js \|\| true` | Lints the 31KB `app.js` for syntax issues. Currently non-blocking (`\|\| true`) to avoid CI failure on ES6+ syntax that jshint doesn't fully support. |
| **File Integrity** | Bash checks | Verifies that all 3 critical files exist: `index.html`, `app.js`, `style.css`. **Fails the build** if any are missing — prevents accidental deletion during merges. |
| **Upload Artifact** | `actions/upload-artifact@v4` | Uploads the entire `web-client/` directory as `web-client-build` |

### File Integrity Checks
```bash
if [ ! -f "index.html" ]; then echo "index.html missing"; exit 1; fi
if [ ! -f "app.js" ]; then echo "app.js missing"; exit 1; fi
if [ ! -f "style.css" ]; then echo "style.css missing"; exit 1; fi
```

---

## 4. Vercel Continuous Deployment (Webhook)

Independent of GitHub Actions, Vercel monitors the repository via a GitHub integration webhook.

### Configuration (`vercel.json`)
```json
{
  "version": 2,
  "rewrites": [
    { "source": "/", "destination": "/web-client/index.html" },
    { "source": "/(.*)", "destination": "/web-client/$1" }
  ]
}
```

### Behavior
- **Trigger:** Any push to `main` that modifies files in `web-client/`
- **Deploy time:** ~10 seconds (static file hosting, no build step)
- **Routing:** All requests are rewritten to serve from the `web-client/` subdirectory
- **Preview deploys:** Pull requests automatically get a preview URL

---

## Workflow Comparison Matrix

| Property | Python Engine | Flutter Mobile | Web Client | Vercel |
|:---------|:-------------|:---------------|:-----------|:-------|
| **File** | `python-engine.yml` | `flutter-mobile.yml` | `web-client.yml` | `vercel.json` |
| **Runner** | `windows-latest` | `ubuntu-latest` | `ubuntu-latest` | Managed |
| **Language** | Python 3.10 | Dart 3.x + Kotlin + Java 17 | Node.js 20 | — |
| **Lint Tool** | flake8 | flutter analyze | jshint | — |
| **Build** | — (lint only) | `flutter build apk --release` | — (validation only) | Static deploy |
| **Artifact** | — | `release-apk` (APK) | `web-client-build` (files) | Live URL |
| **Blocks on failure** | Syntax errors only (E9,F63,F7,F82) | Dart errors only (not infos/warnings) | Missing files only | — |
| **Caching** | pip cache | Flutter SDK cache | — | CDN edge cache |

---

## Monitoring & Maintenance

### Badge URLs (for README)
```markdown
[![Python Engine CI](https://github.com/RajTewari01/Spatial_tracer/actions/workflows/python-engine.yml/badge.svg)](...)
[![Flutter Mobile CI](https://github.com/RajTewari01/Spatial_tracer/actions/workflows/flutter-mobile.yml/badge.svg)](...)
```

### Common Failure Modes

| Failure | Cause | Fix |
|:--------|:------|:----|
| flake8 E9 on Windows | Actual Python syntax error | Fix the syntax error in the flagged file |
| `flutter analyze` error | Missing import, type error, or breaking API change | Fix the Dart code or update the dependency |
| `flutter build apk` failure | Gradle version mismatch, Android SDK issue, or Kotlin compile error | Check `build.gradle` versions and `pubspec.yaml` dependency conflicts |
| Missing web files | Merge conflict deleted `index.html`, `app.js`, or `style.css` | Restore the missing file and re-push |
| Vercel deploy failure | Invalid `vercel.json` or file path mismatch | Verify rewrite rules point to existing files |
