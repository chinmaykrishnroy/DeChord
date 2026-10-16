"""Packaged engine entry point. The desktop owns its stdin pipe and lifetime."""

from __future__ import annotations

import argparse
import importlib
import multiprocessing
import os
from pathlib import Path
import signal
import sys
import threading
import time


OWNER_EXIT_TIMEOUT_SECONDS = 5.0


class OwnerState:
    """Forward EOF to the server even when it arrives during native imports."""

    def __init__(self):
        self.lock = threading.Lock()
        self.server = None
        self.exiting = False

    @property
    def should_exit(self):
        with self.lock:
            return self.exiting

    @should_exit.setter
    def should_exit(self, value):
        with self.lock:
            self.exiting = value
            if self.server is not None:
                self.server.should_exit = value

    def bind(self, server):
        with self.lock:
            self.server = server
            server.should_exit = self.exiting


def watch_owner(server):
    # EOF cannot confuse a recycled OS process ID with our owner.
    sys.stdin.buffer.read()
    server.should_exit = True
    # A stopped Uvicorn loop does not mean the process exited: Python joins
    # active executor workers during interpreter shutdown. Keep a real deadline.
    time.sleep(OWNER_EXIT_TIMEOUT_SECONDS)
    if os.name == "posix" and os.getpgrp() == os.getpid():
        # Rust gives this engine a private group, including its media children.
        os.killpg(os.getpgrp(), signal.SIGKILL)
    os._exit(0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--owned", action="store_true")
    args = parser.parse_args()
    if not 0 < args.port < 65536:
        parser.error("port must be between 1 and 65535")
    owner = OwnerState()
    # Frozen Windows DLL initialization can deadlock with a Python pipe-reader
    # thread already running. Rust's JobObject owns the process during imports.
    defer_owner_watch = os.name == "nt" and getattr(sys, "frozen", False)
    if args.owned and not defer_owner_watch:
        threading.Thread(target=watch_owner, args=(owner,), daemon=True).start()
    resource_root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
    if getattr(sys, "frozen", False):
        from backend.core.integrity import verify_models

        verify_models(resource_root)
    if os.environ.get("DECHORD_DIAGNOSTICS") == "1":
        import faulthandler

        faulthandler.dump_traceback_later(60, repeat=True)
    if data_dir := os.environ.get("DECHORD_DATA_DIR"):
        os.environ.setdefault("NUMBA_CACHE_DIR", str(Path(data_dir) / "numba"))
    binary_dir = resource_root / "bin"
    if binary_dir.is_dir():
        os.environ["PATH"] = str(binary_dir) + os.pathsep + os.environ.get("PATH", "")
    os.environ.setdefault("OMP_NUM_THREADS", "2")
    if getattr(sys, "frozen", False):
        # On Windows, lazy torch import from the analysis thread can deadlock
        # while its native extension imports NumPy under the DLL loader lock.
        # Initialize the native runtimes in dependency order on the main thread.
        for module in (
            "numpy",
            "scipy.linalg",
            "scipy.signal",
            "scipy.ndimage",
            "torch",
            "librosa.core.audio",
            "librosa.core.constantq",
            "librosa.feature.spectral",
            "librosa.feature.rhythm",
            "lv_chordia",
        ):
            print(f"Initializing {module}", file=sys.stderr, flush=True)
            importlib.import_module(module)
    import uvicorn
    from backend.app.main import app

    server = uvicorn.Server(
        uvicorn.Config(
            app, host="127.0.0.1", port=args.port, access_log=False, log_level="warning"
        )
    )
    owner.bind(server)
    if args.owned and defer_owner_watch:
        threading.Thread(target=watch_owner, args=(owner,), daemon=True).start()
    if owner.should_exit:
        return
    server.run()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
