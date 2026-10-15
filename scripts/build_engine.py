"""Build a relocatable engine folder, including CPU models and media tools."""

from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parents[1]
    import static_ffmpeg

    static_ffmpeg.add_paths(weak=True)
    weights = Path(sys.prefix) / "share/lv-chordia/cache_data"
    checkpoints = sorted(weights.glob("*.sdict"))
    if len(checkpoints) != 5 or any(
        path.stat().st_size < 1_000_000 for path in checkpoints
    ):
        raise RuntimeError(
            "The five bundled lv-chordia checkpoints are missing or incomplete"
        )
    manifest_path = root / "build/model-files.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(
            {
                path.name: hashlib.sha256(path.read_bytes()).hexdigest()
                for path in checkpoints
            }
        ),
        encoding="utf-8",
    )
    binaries = []
    for name in ("ffmpeg", "ffprobe"):
        path = shutil.which(name)
        if path is None:
            raise RuntimeError(f"{name} is required to create the offline bundle")
        binaries += ["--add-binary", f"{path}{os.pathsep}bin"]
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onedir",
        "--name",
        "dechord-engine",
        "--distpath",
        str(root / "frontend/src-tauri/resources"),
        "--workpath",
        str(root / "build/engine"),
        "--specpath",
        str(root / "build"),
        "--paths",
        str(root),
        "--collect-submodules",
        "backend",
        "--collect-submodules",
        "uvicorn",
        "--copy-metadata",
        "lv-chordia",
        "--copy-metadata",
        "torch",
        "--collect-all",
        "lv_chordia",
        "--collect-all",
        "librosa",
        "--collect-all",
        "numba",
        "--collect-all",
        "llvmlite",
        "--collect-all",
        "soundfile",
        "--add-data",
        f"{weights}{os.pathsep}cache_data",
        "--add-data",
        f"{manifest_path}{os.pathsep}.",
        "--add-data",
        f"{root / 'backend/test_backend.html'}{os.pathsep}backend",
        *binaries,
        str(root / "backend/desktop_entry.py"),
    ]
    subprocess.run(command, cwd=root, check=True)
    # Keep resource naming independent of PyInstaller's executable name.
    built = root / "frontend/src-tauri/resources/dechord-engine"
    destination = root / "frontend/src-tauri/resources/engine"
    if destination.exists():
        if (
            destination.resolve().parent
            != (root / "frontend/src-tauri/resources").resolve()
        ):
            raise RuntimeError(
                "Refusing to replace engine output outside the build resource directory"
            )
        shutil.rmtree(destination)
    built.rename(destination)
    manifest = subprocess.check_output(
        [sys.executable, "-m", "pip", "freeze"], text=True
    )
    (destination / "DEPENDENCIES.txt").write_text(manifest, encoding="utf-8")
    shutil.copy2(root / "LICENSE", destination / "LICENSE-DeChord.txt")
    for name in ("ffmpeg", "ffprobe"):
        details = subprocess.run(
            [shutil.which(name), "-L"], capture_output=True, text=True, check=True
        )
        (destination / f"LICENSE-{name}.txt").write_text(
            details.stdout + details.stderr, encoding="utf-8"
        )


if __name__ == "__main__":
    main()
