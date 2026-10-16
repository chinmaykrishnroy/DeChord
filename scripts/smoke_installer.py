"""Install, launch and uninstall in an ephemeral Windows CI account only."""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

from check_windows_icons import ico_frames, verify_icon


def main():
    if os.name != "nt" or os.environ.get("GITHUB_ACTIONS") != "true":
        raise RuntimeError("Installer acceptance runs only on ephemeral Windows CI")
    import winreg

    parser = argparse.ArgumentParser()
    parser.add_argument("installer", type=Path)
    args = parser.parse_args()
    keys = (
        r"Software\Microsoft\Windows\CurrentVersion\Uninstall\DeChord",
        r"Software\dechord\DeChord",
    )

    def key_exists(name):
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, name):
                return True
        except FileNotFoundError:
            return False

    if any(key_exists(key) for key in keys):
        raise RuntimeError(
            "A DeChord installation already exists; refusing to replace it"
        )
    expected = ico_frames(
        Path(__file__).resolve().parents[1] / "frontend/src-tauri/icons/icon.ico"
    )
    with tempfile.TemporaryDirectory(prefix="dechord-install-") as folder:
        install = Path(folder) / "DeChord"
        subprocess.run(
            [str(args.installer.resolve()), "/S", f"/D={install}"],
            check=True,
            timeout=300,
        )
        binary = install / "dechord.exe"
        uninstaller = install / "uninstall.exe"
        try:
            verify_icon(binary, expected)
            verify_icon(uninstaller, expected)
            subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).with_name("smoke_desktop.py")),
                    str(binary),
                ],
                check=True,
                timeout=260,
            )
        finally:
            if uninstaller.is_file():
                subprocess.run([str(uninstaller), "/S"], check=True, timeout=60)
                deadline = time.monotonic() + 90
                while binary.exists() or any(key_exists(key) for key in keys):
                    if time.monotonic() >= deadline:
                        raise AssertionError(
                            "Uninstall left application files or registry keys"
                        )
                    time.sleep(0.5)
        print(
            "Windows install, installed icons, startup and uninstall acceptance passed"
        )


if __name__ == "__main__":
    main()
