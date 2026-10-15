"""Launch the real desktop binary and require a report from its rendered frontend."""

import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("binary", type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="dechord-desktop-") as folder:
        report = Path(folder) / "ready.json"
        environment = {
            **os.environ,
            "DECHORD_SMOKE_REPORT": str(report),
            "XDG_DATA_HOME": str(Path(folder) / "data"),
        }
        if os.name == "nt":
            environment["APPDATA"] = str(Path(folder) / "data")
            environment["LOCALAPPDATA"] = str(Path(folder) / "local")
        child = subprocess.Popen([str(args.binary.resolve())], env=environment)
        try:
            assert child.wait(timeout=90) == 0, "Desktop process failed"
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
            raise AssertionError("Desktop frontend did not confirm readiness")
        assert report.is_file(), (
            "No frontend readiness report: the window/engine did not initialize"
        )
        data = json.loads(report.read_text())
        assert data["frontend_ready"] and data["health"]["version"] == "1.0.0", data
        with socket.socket() as probe:
            probe.settimeout(1)
            assert probe.connect_ex(("127.0.0.1", data["port"])) != 0, (
                "Engine remained alive after desktop exit"
            )
        print(json.dumps(data), flush=True)


if __name__ == "__main__":
    main()
