"""Fail packaging if the independently consumed release manifests disagree."""

import ast
import json
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
versions = {
    "frontend": json.loads((root / "frontend/package.json").read_text())["version"],
    "tauri": json.loads((root / "frontend/src-tauri/tauri.conf.json").read_text())[
        "version"
    ],
    "cargo": re.search(
        r'^version = "([^"]+)"',
        (root / "frontend/src-tauri/Cargo.toml").read_text(),
        re.M,
    )[1],
    "api": ast.literal_eval(
        (root / "backend/version.py").read_text().split("__version__ =", 1)[1].strip()
    ),
}
assert len(set(versions.values())) == 1, versions
if len(sys.argv) > 1:
    assert sys.argv[1].removeprefix("v") == versions["api"], versions
print(json.dumps(versions))
