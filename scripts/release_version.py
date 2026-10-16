"""Read the version without importing the analysis runtime."""

import json
from pathlib import Path


def release_version():
    root = Path(__file__).resolve().parents[1]
    return json.loads((root / "frontend/package.json").read_text())["version"]
