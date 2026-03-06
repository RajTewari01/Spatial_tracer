'''
main.py — Vision Tracking Engine CLI Entry Point

Usage:
    python main.py server     # Start only the FastAPI server
    python main.py desktop    # Start server + PyQt desktop app
    python main.py debug      # Run OpenCV debug view (simple_hand_tracer)
    python main.py web        # Start server and open web client in browser

>>> $ python main.py desktop
'''

import argparse
import subprocess
import sys
import os
import time
import webbrowser
import threading
from pathlib import Path

_ROOT = Path(__file__).resolve().parent


def start_server(block: bool = True) -> subprocess.Popen | None:
    """Start the FastAPI server."""
    print("╔══════════════════════════════════════════════════╗")
    print("║   Vision Tracking Engine                        ║")
    print("║   Starting server on http://localhost:8765       ║")
    print("╚══════════════════════════════════════════════════╝")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(_ROOT)

    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "api.fastapi_main:app",
            "--host", "0.0.0.0",
            "--port", "8765",
            "--reload",
        ],
        cwd=str(_ROOT),
        env=env,
    )

    if block:
        try:
            proc.wait()
        except KeyboardInterrupt:
            print("\n[main] Shutting down server...")
            proc.terminate()
        return None
    return proc


def open_web_client(delay: float = 2.0):
    """Open the web client in the default browser after a delay."""
    def _open():
        time.sleep(delay)
        webbrowser.open("http://localhost:8765")
    t = threading.Thread(target=_open, daemon=True)
    t.start()


def run_desktop():
    """Start the server and launch the PyQt desktop app."""
    # Start server in background
    server_proc = start_server(block=False)
    time.sleep(1.5)

    try:
        # Import and run the desktop app
        sys.path.insert(0, str(_ROOT / "desktop-client"))
        from app import run_desktop_app
        run_desktop_app()
    except ImportError as e:
        print(f"[error] Could not start desktop app: {e}")
        print("        Make sure PyQt5 is installed: pip install pyqt5")
    finally:
        if server_proc:
            server_proc.terminate()


def run_debug():
    """Run the simple hand tracer debug view."""
    print("[debug] Starting OpenCV debug view...")
    print("[debug] Press 'q' in the camera window to quit.\n")

    sys.path.insert(0, str(_ROOT / "engine"))
    from simple_hand_tracer import InitializeCamera
    InitializeCamera(try_load_model=True).run()


def main():
    parser = argparse.ArgumentParser(
        prog="vision-tracker",
        description="Vision Tracking Engine — Hand gesture virtual keyboard system",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py server     Start the API server
  python main.py desktop    Start desktop app (server + PyQt)
  python main.py web        Start server + open browser
  python main.py debug      OpenCV debug view
        """
    )

    parser.add_argument(
        "mode",
        choices=["server", "desktop", "web", "debug"],
        help="Run mode: server | desktop | web | debug"
    )

    parser.add_argument(
        "--port", type=int, default=8765,
        help="Server port (default: 8765)"
    )

    parser.add_argument(
        "--no-browser", action="store_true",
        help="Don't auto-open browser in web mode"
    )

    args = parser.parse_args()

    if args.mode == "server":
        start_server(block=True)

    elif args.mode == "web":
        if not args.no_browser:
            open_web_client()
        start_server(block=True)

    elif args.mode == "desktop":
        run_desktop()

    elif args.mode == "debug":
        run_debug()


if __name__ == "__main__":
    main()
