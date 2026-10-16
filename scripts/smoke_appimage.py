"""Verify inference from the final AppImage's repackaged engine and libraries."""

import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("appimage", type=Path)
    args = parser.parse_args()
    binary = args.appimage.resolve(strict=True)
    environment = dict(os.environ)
    environment.pop("APPIMAGE_EXTRACT_AND_RUN", None)
    with tempfile.TemporaryDirectory(prefix="dechord-appimage-") as folder:
        subprocess.run(
            [str(binary), "--appimage-extract"],
            cwd=folder,
            env=environment,
            stdout=subprocess.DEVNULL,
            check=True,
        )
        appdir = Path(folder) / "squashfs-root"
        engine = appdir / "usr/lib/DeChord/engine/dechord-engine"
        if not engine.is_file():
            raise RuntimeError("The AppImage does not contain its bundled engine")
        libraries = [
            appdir / part
            for part in ("usr/lib", "usr/lib64", "usr/lib/x86_64-linux-gnu")
        ]
        environment["APPDIR"] = str(appdir)
        environment["LD_LIBRARY_PATH"] = os.pathsep.join(
            [str(path) for path in libraries if path.is_dir()]
            + [environment.get("LD_LIBRARY_PATH", "")]
        )
        subprocess.run(
            [
                sys.executable,
                str(Path(__file__).with_name("smoke_engine.py")),
                str(engine),
            ],
            cwd=folder,
            env=environment,
            check=True,
        )


if __name__ == "__main__":
    main()
