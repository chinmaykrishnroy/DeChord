"""Start the shared local engine with either the web frontend or Tauri shell."""

from __future__ import annotations
import argparse
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.core.runtime import source_revision


def backend_owner(processes, listener_pid, root):
    """Only accept the exact workspace's uvicorn launcher, including Windows venv wrappers."""
    by_id = {item["ProcessId"]: item for item in processes}
    process = by_id.get(listener_pid)
    visited = set()
    while process and process["ProcessId"] not in visited:
        visited.add(process["ProcessId"])
        command = (process.get("CommandLine") or "").replace("/", "\\").lower()
        if (
            "uvicorn backend.app.main:app" in command
            and re.search(r"--port\s+8765(?:\s|$)", command)
            and str(root).replace("/", "\\").lower() + "\\" in command
        ):
            return process["ProcessId"]
        process = by_id.get(process.get("ParentProcessId"))
    return None


def retire_stale_backend():
    if os.name != "nt":
        raise RuntimeError(
            "An older DeChord engine is using port 8765. Stop that backend, then launch again."
        )
    inspection = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-Command",
            "$listener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; "
            "@{ listener = $listener.OwningProcess; processes = @(Get-CimInstance Win32_Process -Filter \"Name = 'python.exe'\" | Select-Object ProcessId,ParentProcessId,CommandLine) } | ConvertTo-Json -Depth 3",
        ],
        capture_output=True,
        text=True,
        check=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    state = json.loads(inspection.stdout)
    owner = backend_owner(state["processes"], state["listener"], ROOT)
    if owner is None:
        raise RuntimeError(
            "Port 8765 belongs to a different or unverified process. Close that service before launching DeChord."
        )
    subprocess.run(
        ["taskkill", "/PID", str(owner), "/T", "/F"],
        capture_output=True,
        check=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    deadline = time.monotonic() + 5
    while backend_health() and time.monotonic() < deadline:
        time.sleep(0.1)


def backend_health():
    try:
        with urlopen("http://127.0.0.1:8765/health", timeout=1) as response:
            return json.load(response)
    except Exception:
        return None


def stop_child(child):
    if child is None or child.poll() is not None:
        return
    if os.name == "nt":
        # npm, Cargo, uvicorn reload and Windows venvs all spawn children.
        subprocess.run(
            ["taskkill", "/PID", str(child.pid), "/T", "/F"],
            capture_output=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    else:
        child.terminate()
    try:
        child.wait(timeout=5)
    except subprocess.TimeoutExpired:
        child.kill()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--desktop", action="store_true")
    parser.add_argument("--backend-only", action="store_true")
    args = parser.parse_args()
    python = next(
        (
            p
            for p in (
                ROOT
                / ".venv"
                / ("Scripts/python.exe" if os.name == "nt" else "bin/python"),
                ROOT
                / "venv"
                / ("Scripts/python.exe" if os.name == "nt" else "bin/python"),
            )
            if p.exists()
        ),
        None,
    )
    if python is None:
        raise SystemExit(
            "Create .venv and install backend/requirements-backend.txt first. See README.md."
        )
    backend = None
    frontend = None
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    revision = source_revision(ROOT)

    def healthy():
        health = backend_health()
        return bool(
            health
            and health.get("service") == "dechord"
            and health.get("revision") == revision
        )

    try:
        existing = backend_health()
        if existing and not healthy():
            if existing.get("service") != "dechord":
                raise RuntimeError("Another service is using port 8765.")
            print("Updating the older local DeChord engine...", flush=True)
            retire_stale_backend()
        if not healthy():
            backend = subprocess.Popen(
                [
                    str(python),
                    "-m",
                    "uvicorn",
                    "backend.app.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8765",
                    "--reload",
                    "--reload-dir",
                    str(ROOT / "backend"),
                ],
                cwd=ROOT,
                creationflags=flags,
            )
            deadline = time.monotonic() + 30
            while not healthy():
                if backend.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError(
                        "Backend could not start on 8765. Check dependencies and whether another service owns the port."
                    )
                time.sleep(0.3)
        print("DeChord engine: http://127.0.0.1:8765", flush=True)
        if args.backend_only:
            if backend:
                backend.wait()
            return
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise RuntimeError("Install Node.js to run the frontend.")
        command = (
            [npm, "run", "tauri:dev"]
            if args.desktop
            else [npm, "run", "dev", "--", "--port", "5184", "--strictPort"]
        )
        print(
            "Desktop shell"
            if args.desktop
            else "Open http://127.0.0.1:5184 in your browser",
            flush=True,
        )
        frontend = subprocess.Popen(command, cwd=ROOT / "frontend")
        frontend.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for child in (frontend, backend):
            stop_child(child)


if __name__ == "__main__":
    main()
