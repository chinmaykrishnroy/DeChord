"""Packaged engine entry point. The desktop owns its stdin pipe and lifetime."""

from __future__ import annotations

import argparse
import importlib
import multiprocessing
import os
from pathlib import Path
import sys
import threading


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--owned", action="store_true")
    args = parser.parse_args()
    if not 0 < args.port < 65536:
        parser.error("port must be between 1 and 65535")
    resource_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    if getattr(sys, "frozen", False):
        from backend.core.integrity import verify_models

        verify_models(resource_root)
        # On Windows, lazy torch import from the analysis thread can deadlock
        # while its native extension imports NumPy under the DLL loader lock.
        # Initialize the native runtimes in dependency order on the main thread.
        for module in ("numpy", "torch", "lv_chordia"):
            print(f"Initializing {module}", file=sys.stderr, flush=True)
            importlib.import_module(module)
    if os.environ.get("DECHORD_DIAGNOSTICS") == "1":
        import faulthandler

        faulthandler.dump_traceback_later(60, repeat=True)
    if data_dir := os.environ.get("DECHORD_DATA_DIR"):
        os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(data_dir) / "numba"))
    binary_dir = resource_root / "bin"
    if binary_dir.is_dir():
        os.environ["PATH"] = str(binary_dir) + os.pathsep + os.environ.get("PATH", "")
    import uvicorn
    from backend.app.main import app

    server = uvicorn.Server(
        uvicorn.Config(
            app, host="127.0.0.1", port=args.port, access_log=False, log_level="warning"
        )
    )
    stopped = threading.Event()

    def watch_owner():
        # EOF is portable and cannot confuse a recycled OS process ID with our owner.
        sys.stdin.buffer.read()
        server.should_exit = True
        if not stopped.wait(5):
            os._exit(0)

    if args.owned:
        threading.Thread(target=watch_owner, daemon=True).start()
    try:
        server.run()
    finally:
        stopped.set()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
