# Enterprise CI/CD Workflows

Spatial_Tracer employs an advanced distributed infrastructure leveraging strictly immutable GitHub Actions environments. The code is structured in `.github/workflows`.

## 1. Python Engine Security & Syntax CI (`python-engine.yml`)

The desktop platform utilizes extreme OS-level permissions via `pynput` and `win32api`. Ensuring strict code safety checks is critical.

*   **Trigger Matrix**: Automatic execution strictly on pulls towards the `main` branch when Python internal files are touched.
*   **Environment**: We utilize the `windows-latest` executor.
    *   *Why?* Unlike REST APIs, the backend natively bridges Windows DLLs (`pywin32`) to spoof hardware pointer events. Utilizing `ubuntu-latest` would fail drastically because the Linux virtual machine completely lacks Windows user-space graphical drivers.
*   **Safety Net Pipeline**:
    ```yaml
        - name: Lint with flake8
          run: |
            flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
    ```
    This actively rejects invalid Python semantics, preventing bad syntax from permanently crippling production desktop builds.

## 2. Flutter Mobile Matrix CI (`flutter-mobile.yml`)

Compiling an Android `AccessibilityService` requires stringent native Kotlin and Gradle coordination.

*   **Virtual Bootstrapping**:
    We boot up a clean `ubuntu-latest` image. Within 40 seconds, it chains:
    1.  `actions/setup-java@v3` (Zulu distribution of OpenJDK 17).
    2.  `subosito/flutter-action@v2` (Stable master channel for Flutter SDK).
*   **Compilation Algorithm**:
    The system runs the strict analytical dart profiler: `flutter analyze`.
    It executes the Gradle `--release` command, performing obfuscation, dead-code stripping (Tree shaking), and binary compression.
*   **Artifacts**: It captures the raw output from `build/app/outputs/flutter-apk/app-release.apk` and utilizes `actions/upload-artifact@v4` to host the APK securely for QA downloading.

## 3. Web Client DOM Validation CI (`web-client.yml`)

A streamlined workflow meant for our HTML canvas applications.

*   **DOM Auditing**: Installs `jshint` via NodeJS onto an Ubuntu executor.
*   **System Check**: Mathematically checks for the exact file structures required (`index.html`, `app.js`, `style.css`) ensuring no merge conflict ever accidentally drops critical web assets.
*   **Continuous Deployment**: Independent of GitHub Actions, we employ native webhook triggers into Vercel's global CDN, causing the master UI to deploy silently in under 10 seconds post-merge.
