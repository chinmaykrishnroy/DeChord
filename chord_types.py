import re
from dataclasses import dataclass
from typing import Optional


ROOT_PATTERN = r"(?P<root>[A-G](?:#|b)?)"
CHORD_PATTERN = re.compile(
    rf"^\s*{ROOT_PATTERN}(?::(?P<colon_quality>[^/]+)|(?P<suffix>[^/]*))?(?:/(?P<bass>[A-G](?:#|b)?))?\s*$"
)

COLON_QUALITY_MAP = {
    "maj": "",
    "major": "",
    "min": "m",
    "minor": "m",
    "m": "m",
    "7": "7",
    "maj7": "maj7",
    "major7": "maj7",
    "min7": "m7",
    "minor7": "m7",
    "m7": "m7",
    "6": "6",
    "maj6": "6",
    "min6": "m6",
    "m6": "m6",
    "9": "9",
    "maj9": "maj9",
    "min9": "m9",
    "m9": "m9",
    "11": "11",
    "13": "13",
    "sus": "sus4",
    "sus2": "sus2",
    "sus4": "sus4",
    "dim": "dim",
    "dim7": "dim7",
    "hdim7": "m7b5",
    "min7b5": "m7b5",
    "m7b5": "m7b5",
    "aug": "aug",
    "+": "aug",
}

SUFFIX_ALIASES = {
    "major": "",
    "maj": "",
    "minor": "m",
    "min": "m",
    "-": "m",
    "+": "aug",
    "o": "dim",
    "0": "dim",
    "hdim7": "m7b5",
    "min7b5": "m7b5",
}


@dataclass(frozen=True)
class ChordLabel:
    source: str
    root: Optional[str]
    suffix: str = ""
    bass: Optional[str] = None
    is_no_chord: bool = False

    @property
    def display(self) -> str:
        if self.is_no_chord:
            return "N"
        if self.root is None:
            return self.source
        bass = f"/{self.bass}" if self.bass else ""
        return f"{self.root}{self.suffix}{bass}"

    @property
    def simple_display(self) -> str:
        if self.is_no_chord:
            return "N"
        if self.root is None:
            return self.source
        suffix = self.suffix
        if suffix.startswith("m") and not suffix.startswith("maj"):
            suffix = "m"
        elif suffix.startswith(("dim", "aug", "sus")):
            suffix = re.match(r"(dim|aug|sus2|sus4|sus)", suffix).group(1)
        else:
            suffix = ""
        return f"{self.root}{suffix}"


def normalize_chord_label(label: Optional[str], display_mode: str = "advanced") -> str:
    chord = parse_chord_label(label)
    if display_mode == "simple":
        return chord.simple_display
    return chord.display


def parse_chord_label(label: Optional[str]) -> ChordLabel:
    source = (label or "").strip()
    if not source or source.upper() in {"N", "NC", "N.C.", "NO_CHORD", "NO CHORD"}:
        return ChordLabel(source=source, root=None, is_no_chord=True)

    source = source.replace("\u266f", "#").replace("\u266d", "b")
    match = CHORD_PATTERN.match(source)
    if not match:
        return ChordLabel(source=source, root=None, suffix=source)

    root = match.group("root")
    bass = match.group("bass")
    colon_quality = match.group("colon_quality")
    suffix = match.group("suffix") or ""

    if colon_quality is not None:
        suffix = _normalize_colon_quality(colon_quality)
    else:
        suffix = _normalize_suffix(suffix)

    return ChordLabel(source=source, root=root, suffix=suffix, bass=bass)


def _normalize_colon_quality(quality: str) -> str:
    normalized = quality.strip().replace(" ", "")
    return COLON_QUALITY_MAP.get(normalized.lower(), normalized)


def _normalize_suffix(suffix: str) -> str:
    normalized = suffix.strip().replace(" ", "")
    if not normalized:
        return ""
    return SUFFIX_ALIASES.get(normalized.lower(), normalized)
