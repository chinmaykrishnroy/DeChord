"""Create the Windows portable artifact from the same verified desktop/engine files."""

import os
from pathlib import Path
import shutil
from release_version import release_version


def main():
    if os.name != "nt":
        raise RuntimeError("The portable Windows package must be built on Windows")
    root = Path(__file__).resolve().parents[1]
    output = root / "build/portable/DeChord"
    if output.exists():
        if output.resolve().parent != (root / "build/portable").resolve():
            raise RuntimeError(
                "Refusing to replace files outside the portable build directory"
            )
        shutil.rmtree(output)
    output.mkdir(parents=True)
    shutil.copy2(
        root / "frontend/src-tauri/target/release/dechord.exe", output / "dechord.exe"
    )
    shutil.copytree(root / "frontend/src-tauri/resources/engine", output / "engine")
    shutil.copy2(root / "LICENSE", output / "LICENSE.txt")
    shutil.copy2(root / "RELEASE_NOTES.md", output / "README.md")
    releases = root / "build/releases"
    releases.mkdir(exist_ok=True)
    shutil.make_archive(
        str(releases / f"DeChord_{release_version()}_windows_x64_portable"),
        "zip",
        root_dir=output.parent,
        base_dir=output.name,
    )


if __name__ == "__main__":
    main()
