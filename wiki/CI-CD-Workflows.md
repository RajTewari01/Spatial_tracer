# CI/CD Workflows & Deployment Infrastructure

Spatial_Tracer runs **6 GitHub Actions workflows** plus a Vercel webhook for continuous deployment. Each workflow is path-scoped — it only triggers when files in its domain change.

## Pipeline Overview

```
Push / PR to main
├── engine/ api/ desktop-client/ main.py requirements.txt
│   └── Python Engine CI (windows-latest)
│       ├── Job 1: Lint (flake8 fatal + advisory)
│       └── Job 2: Validate (imports, CLI, config integrity)
│
├── mobile-client/
│   └── Flutter Mobile CI (ubuntu-latest)
│       ├── Job 1: Analyze (dart analysis + tests + dep check)
│       └── Job 2: Build (release APK + size report + upload)
│
├── web-client/
│   ├── Web Client CI (ubuntu-latest)
│   │   ├── jshint lint
│   │   ├── HTML structure validation
│   │   ├── CDN availability check
│   │   ├── Bundle size report
│   │   └── Upload artifact
│   └── Vercel Webhook (automatic deploy)
│
├── All files (+ weekly Monday 6AM UTC)
│   └── Security Audit (ubuntu-latest)
│       ├── pip-audit + safety (Python CVEs)
│       ├── flutter pub outdated
│       └── Secrets/credentials scan
│
├── *.md files
│   └── Docs Integrity (ubuntu-latest)
│       ├── Markdown lint
│       ├── Internal link validation
│       ├── Proof media inventory
│       └── Documentation coverage stats
│
└── v* tags
    └── Release Pipeline (multi-platform)
        ├── Desktop package (Windows zip)
        ├── Android APK (Ubuntu Flutter build)
        ├── Web client bundle (Ubuntu zip)
        └── GitHub Release with all 3 artifacts
```

---

## 1. Python Engine CI (`python-engine.yml`)

**Runner:** `windows-latest`
**Why Windows?** The engine uses `pynput` and `ctypes.windll.user32` for OS-level mouse/keyboard control. These are Windows-only APIs — `ubuntu-latest` would fail on import.

### Trigger Paths
```yaml
paths:
  - 'engine/**'
  - 'api/**'
  - 'desktop-client/**'
  - 'main.py'
  - 'requirements.txt'
```

### Job 1: Lint

| Step | Details |
|:-----|:--------|
| Python Setup | Python 3.10 with pip caching |
| Install | `flake8` + all `requirements.txt` deps |
| **Lint (fatal)** | `flake8 --select=E9,F63,F7,F82` — **fails build** on syntax errors, undefined names |
| **Lint (advisory)** | `flake8 --exit-zero --max-complexity=10 --max-line-length=127` — reports warnings only |

Exclusions: `mobile-client, web-client, wiki, vision_tracker, venv, .venv, env, Lib, Scripts`

### Job 2: Validate (depends on Lint)

| Step | Details |
|:-----|:--------|
| **Engine imports** | `from engine import HeadlessHandTracker, GestureDetector` — verifies package resolves |
| **API imports** | `from api.fastapi_main import app` — verifies FastAPI app instantiates |
| **CLI check** | `python main.py --help` — verifies argparse entry point works |
| **Config integrity** | Checks `hand_landmarker.task` exists and is > 1MB, `mapping.json` has 60+ keyboard keys |

---

## 2. Flutter Mobile CI (`flutter-mobile.yml`)

**Runner:** `ubuntu-latest`
**Why Ubuntu?** Flutter's Android toolchain (Gradle, SDK, Java) runs identically on Linux and is faster than Windows runners.

### Trigger Paths
```yaml
paths:
  - 'mobile-client/**'
```

### Job 1: Analyze

| Step | Details |
|:-----|:--------|
| Java Setup | Zulu OpenJDK 17 (required by Gradle 8.x) |
| Flutter Setup | Flutter 3.x stable with SDK caching |
| **Analyze** | `flutter analyze --no-fatal-infos --no-fatal-warnings` — only errors break the build |
| **Tests** | `flutter test` — runs widget tests (non-blocking) |
| **Dep check** | `flutter pub outdated` → reported in GitHub Step Summary |

### Job 2: Build (depends on Analyze)

| Step | Details |
|:-----|:--------|
| **Build APK** | `flutter build apk --release` — R8 shrinking, Kotlin compilation, tree shaking |
| **Size report** | APK size reported in GitHub Step Summary |
| **Upload** | `release-apk` artifact — downloadable from Actions run page |

**APK output:** `mobile-client/build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Web Client CI (`web-client.yml`)

**Runner:** `ubuntu-latest`

### Trigger Paths
```yaml
paths:
  - 'web-client/**'
```

### Steps

| Step | Details |
|:-----|:--------|
| **JS Lint** | `jshint app.js` — non-blocking (ES6+ compatibility) |
| **File integrity** | Verifies `index.html`, `app.js`, `style.css` exist with sizes — **fails build** if any missing |
| **HTML validation** | Checks for `<script src="./app.js">`, `<link href="./style.css">`, MediaPipe CDN, Three.js CDN tags |
| **CDN check** | Curls Three.js and MediaPipe CDN URLs, reports HTTP status codes in Step Summary |
| **Bundle report** | File sizes table in Step Summary |
| **Upload** | `web-client-build` artifact |

---

## 4. Security Audit (`security-audit.yml`) 🆕

**Runner:** `ubuntu-latest`
**Triggers:** Every push/PR + **weekly on Monday 6AM UTC** (cron schedule)

### Jobs

| Job | What It Does |
|:----|:-------------|
| **Python Security** | Installs all deps → runs `pip-audit --strict` for known CVEs → runs `safety check --full-report` → dependency inventory in Step Summary |
| **Flutter Security** | `flutter pub get` → `flutter pub outdated` → reports outdated packages in Step Summary |
| **Secrets Scan** | Greps all `.py`, `.kt`, `.dart`, `.js`, `.json` files for patterns: `PRIVATE_KEY`, `api_key`, `secret_key`, `password=`, `token=`, `-----BEGIN`, `sk-`, `AIza` |

---

## 5. Documentation Integrity (`docs-integrity.yml`) 🆕

**Runner:** `ubuntu-latest`
**Triggers:** Any `.md` file change

### Steps

| Step | Details |
|:-----|:--------|
| **Markdown lint** | Uses `markdownlint-cli2-action` — disabled rules: MD013 (line length), MD033 (inline HTML), MD041 (first line heading), MD024 (duplicate headings), MD036 (emphasis as heading) |
| **Link validation** | Extracts all `wiki/` and `proofs/` links from README.md, checks each file exists. Reports ✅/❌ per link |
| **Media inventory** | Lists all files in `proofs/` with type and size in a Step Summary table |
| **Coverage stats** | Reports README line count + wiki page count + total wiki lines |

---

## 6. Release Pipeline (`release.yml`) 🆕

**Triggers:** Git tags matching `v*` (e.g., `git tag v1.0.0 && git push --tags`)
**Permissions:** `contents: write` (required to create GitHub Releases)

### Jobs (parallel → final)

| Job | Runner | Output |
|:----|:-------|:-------|
| **build-desktop** | `windows-latest` | Validates engine imports → zips `engine/`, `api/`, `desktop-client/`, `config/`, `main.py`, `requirements.txt` → `spatial-tracer-desktop.zip` |
| **build-mobile** | `ubuntu-latest` | `flutter test` → `flutter build apk --release` → `app-release.apk` |
| **build-web** | `ubuntu-latest` | Validates file existence → zips `index.html`, `app.js`, `style.css` → `spatial-tracer-web.zip` |
| **create-release** | `ubuntu-latest` (needs all 3) | Downloads all artifacts → creates GitHub Release with auto-generated release notes + all 3 files attached |

### Usage
```bash
git tag v1.0.0
git push origin v1.0.0
# → GitHub Release created automatically with desktop zip, APK, and web zip
```

---

## 7. Vercel Continuous Deployment (Webhook)

Independent of GitHub Actions — monitors the repo via GitHub integration.

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

- **Trigger:** Any push to `main` touching `web-client/`
- **Deploy time:** ~10 seconds (static hosting, no build step)
- **Preview deploys:** PRs get automatic preview URLs

---

## Workflow Comparison Matrix

| Property | Python Engine | Flutter Mobile | Web Client | Security | Docs | Release |
|:---------|:-------------|:---------------|:-----------|:---------|:-----|:--------|
| **File** | `python-engine.yml` | `flutter-mobile.yml` | `web-client.yml` | `security-audit.yml` | `docs-integrity.yml` | `release.yml` |
| **Runner** | `windows-latest` | `ubuntu-latest` | `ubuntu-latest` | `ubuntu-latest` | `ubuntu-latest` | Multi-platform |
| **Jobs** | lint → validate | analyze → build | lint-and-validate | 3 parallel | validate-docs | 3 parallel → release |
| **Trigger** | Path-scoped | Path-scoped | Path-scoped | All + weekly cron | `*.md` files | `v*` tags |
| **Artifacts** | — | `release-apk` | `web-client-build` | — | — | GitHub Release |
| **Caching** | pip | Flutter SDK | — | — | — | pip + Flutter |

---

## Common Failure Modes

| Failure | Cause | Fix |
|:--------|:------|:----|
| flake8 E9 on Windows | Python syntax error | Fix the syntax in the flagged file |
| Import validation fails | Missing dependency or broken `__init__.py` | Check `requirements.txt` and package `__init__` |
| `flutter analyze` error | Missing import, type error, or breaking API change | Fix the Dart code or update dependency |
| `flutter build apk` fails | Gradle version mismatch or Kotlin compile error | Check `build.gradle` versions |
| Missing web files | Merge conflict deleted a critical file | Restore `index.html`, `app.js`, or `style.css` |
| CDN check fails | Three.js or MediaPipe CDN is down | Usually temporary — re-run the workflow |
| pip-audit CVE found | Known vulnerability in a Python package | Update the package version in `requirements.txt` |
| Secrets scan warning | Pattern matched in source code | Review the match — may be a false positive |
| Release fails | Missing `GITHUB_TOKEN` permission | Ensure `permissions: contents: write` in workflow |
