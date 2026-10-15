"""Verify the packaged inference artifacts before serving desktop requests."""

import hashlib
import json
from pathlib import Path


def verify_models(resource_root: Path) -> None:
    manifest = json.loads((resource_root / "model-files.json").read_text())
    if len(manifest) != 5:
        raise RuntimeError(
            "The packaged engine does not contain its five model checkpoints"
        )
    for name, expected in manifest.items():
        if Path(name).name != name:
            raise RuntimeError("Invalid packaged model path")
        path = resource_root / "cache_data" / name
        if (
            not path.is_file()
            or hashlib.sha256(path.read_bytes()).hexdigest() != expected
        ):
            raise RuntimeError(
                f"Packaged model is missing or damaged: {name}. Reinstall DeChord."
            )
