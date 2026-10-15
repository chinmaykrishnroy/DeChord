"""Identity shared by the local launcher and its backend process."""

import hashlib
from pathlib import Path


def source_revision(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted((root / "backend").rglob("*.py")):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()[:20]
