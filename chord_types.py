import re
from dataclasses import dataclass
from typing import Optional


ROOT_PATTERN = r"(?P<root>[A-G](?:#|b)?)"
CHORD_PATTERN = re.compile(
    rf"^\s*{ROOT_PATTERN}(?::(?P<colon_quality>[^/]+)|(?P<suffix>[^/]*))?(?:/(?P<bass>[A-G](?:#|b)?|(?:#|b)?[1-7]))?\s*$"
)

NOTE_TO_PC = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "E#": 5,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
}

SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
FLAT_KEYS = {"F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"}
BASS_INTERVAL_TO_SEMITONES = {
    "1": 0,
    "b2": 1,
    "2": 2,
    "b3": 3,
    "3": 4,
    "4": 5,
    "#4": 6,
    "b5": 6,
    "5": 7,
    "b6": 8,
    "6": 9,
    "b7": 10,
    "7": 11,
}

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
    "suspended": "sus4",
    "sustained": "sus4",
    "sus2": "sus2",
    "sus4": "sus4",
    "dim": "dim",
    "dim7": "dim7",
    "hdim7": "m7b5",
    "min7b5": "m7b5",
    "m7b5": "m7b5",
    "aug": "aug",
    "aug7": "aug7",
    "+": "aug",
    "5": "5",
}

SUFFIX_ALIASES = {
    "major": "",
    "maj": "",
    "minor": "m",
    "min": "m",
    "suspended": "sus4",
    "sustained": "sus4",
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

    @property
    def intervals(self) -> list[int]:
        if self.is_no_chord or self.root is None:
            return []
        return intervals_for_suffix(self.suffix)

    @property
    def notes(self) -> list[str]:
        if self.is_no_chord or self.root is None:
            return []
        return notes_for_chord(self.root, self.intervals, self.suffix)

    @property
    def quality_name(self) -> str:
        if self.is_no_chord:
            return "No chord"
        if self.root is None:
            return "Unknown"
        return quality_name_for_suffix(self.suffix)

    @property
    def details(self) -> str:
        if self.is_no_chord:
            return "No chord"
        if self.root is None:
            return self.source
        parts = [self.quality_name]
        notes = self.notes
        if notes:
            parts.append(f"Notes: {' '.join(notes)}")
        if self.bass:
            parts.append(f"Bass: {self.bass}")
        return " | ".join(parts)


def normalize_chord_label(label: Optional[str], display_mode: str = "advanced") -> str:
    chord = parse_chord_label(label)
    if display_mode == "simple":
        return chord.simple_display
    return chord.display


def chord_details_text(label: Optional[str]) -> str:
    return parse_chord_label(label).details


def chord_notes(label: Optional[str]) -> list[str]:
    return parse_chord_label(label).notes


def transpose_chord_label(label: Optional[str], semitones: int) -> str:
    chord = parse_chord_label(label)
    if chord.is_no_chord:
        return "N"
    if chord.root is None:
        return chord.source

    root = transpose_note(chord.root, semitones)
    bass = transpose_note(chord.bass, semitones) if chord.bass else None
    return ChordLabel(
        source=chord.source,
        root=root,
        suffix=chord.suffix,
        bass=bass,
        is_no_chord=chord.is_no_chord,
    ).display


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

    if bass in BASS_INTERVAL_TO_SEMITONES:
        bass = note_for_interval(root, BASS_INTERVAL_TO_SEMITONES[bass])

    return ChordLabel(source=source, root=root, suffix=suffix, bass=bass)


def _normalize_colon_quality(quality: str) -> str:
    normalized = quality.strip().replace(" ", "")
    normalized = normalized.replace("major", "maj").replace("minor", "min")
    normalized = normalized.replace("sus4(b7,9,13)", "13sus4")
    normalized = normalized.replace("sus4(b7,9)", "9sus4")
    normalized = normalized.replace("sus4(b7)", "7sus4")
    normalized = normalized.replace("sus2(b7)", "7sus2")
    normalized = normalized.replace("sus4(9)", "sus4add9")
    normalized = normalized.replace("aug(b7)", "aug7")
    normalized = normalized.replace("maj6(9)", "6add9")
    normalized = normalized.replace("maj(9)", "add9")
    normalized = normalized.replace("maj(2)", "add9")
    normalized = normalized.replace("maj(4)", "add11")
    normalized = normalized.replace("maj(11)", "add11")
    normalized = normalized.replace("min(9)", "madd9")
    normalized = normalized.replace("min(11)", "madd11")
    normalized = normalized.replace("min7(9)", "m9")
    normalized = normalized.replace("min7(11)", "m11")
    normalized = normalized.replace("7(b9)", "7b9")
    normalized = normalized.replace("7(#9)", "7#9")
    return COLON_QUALITY_MAP.get(normalized.lower(), normalized)


def _normalize_suffix(suffix: str) -> str:
    normalized = suffix.strip().replace(" ", "")
    if not normalized:
        return ""
    return SUFFIX_ALIASES.get(normalized.lower(), normalized)


def intervals_for_suffix(suffix: str) -> list[int]:
    suffix_lower = suffix.lower()

    if suffix_lower.startswith("m7b5"):
        intervals = [0, 3, 6, 10]
    elif suffix_lower.startswith("dim7"):
        intervals = [0, 3, 6, 9]
    elif suffix_lower.startswith("dim"):
        intervals = [0, 3, 6]
    elif suffix_lower.startswith("aug"):
        intervals = [0, 4, 8]
    elif "sus2" in suffix_lower:
        intervals = [0, 2, 7]
    elif "sus4" in suffix_lower or suffix_lower.startswith("sus"):
        intervals = [0, 5, 7]
    elif suffix_lower == "5":
        intervals = [0, 7]
    elif suffix_lower.startswith("m") and not suffix_lower.startswith("maj"):
        intervals = [0, 3, 7]
    else:
        intervals = [0, 4, 7]

    intervals = apply_extensions(intervals, suffix_lower)
    intervals = apply_alterations(intervals, suffix_lower)
    return unique_intervals(intervals)


def apply_extensions(intervals: list[int], suffix: str) -> list[int]:
    if "maj13" in suffix:
        intervals.extend([11, 14, 17, 21])
    elif "13" in suffix:
        intervals.extend([10, 14, 17, 21])
    elif "maj11" in suffix:
        intervals.extend([11, 14, 17])
    elif "11" in suffix:
        intervals.extend([10, 14, 17])
    elif "maj9" in suffix:
        intervals.extend([11, 14])
    elif "9" in suffix:
        intervals.extend([10, 14])
    elif "maj7" in suffix or "mmaj7" in suffix:
        intervals.append(11)
    elif "dim7" not in suffix and "m7b5" not in suffix and "7" in suffix:
        intervals.append(10)
    elif "6" in suffix:
        intervals.append(9)

    if "add9" in suffix and 14 not in intervals:
        intervals.append(14)
    return intervals


def apply_alterations(intervals: list[int], suffix: str) -> list[int]:
    if "b5" in suffix:
        intervals = [6 if interval % 12 in {7, 8} else interval for interval in intervals]
    if "#5" in suffix:
        intervals = [8 if interval % 12 in {7, 6} else interval for interval in intervals]
    if "b9" in suffix:
        intervals = [interval for interval in intervals if interval % 12 != 2]
        intervals.append(13)
    if "#9" in suffix:
        intervals = [interval for interval in intervals if interval % 12 != 2]
        intervals.append(15)
    if "#11" in suffix:
        intervals = [interval for interval in intervals if interval % 12 != 5]
        intervals.append(18)
    if "b13" in suffix:
        intervals = [interval for interval in intervals if interval % 12 != 9]
        intervals.append(20)
    return intervals


def unique_intervals(intervals: list[int]) -> list[int]:
    seen = set()
    unique = []
    for interval in intervals:
        pitch_class = interval % 12
        if pitch_class in seen:
            continue
        seen.add(pitch_class)
        unique.append(interval)
    return unique


def notes_for_chord(root: str, intervals: list[int], suffix: str = "") -> list[str]:
    root_pc = NOTE_TO_PC.get(root)
    if root_pc is None:
        return []
    names = note_names_for_chord(root, suffix)
    return [names[(root_pc + interval) % 12] for interval in intervals]


def note_names_for_chord(root: str, suffix: str) -> list[str]:
    if root in FLAT_KEYS or "b" in root:
        return FLAT_NOTES
    if "#" in root:
        return SHARP_NOTES

    suffix_lower = suffix.lower()
    if suffix_lower.startswith("aug") or "#5" in suffix_lower:
        return SHARP_NOTES
    if (
        suffix_lower.startswith("m") and not suffix_lower.startswith("maj")
        or suffix_lower.startswith(("dim", "sus"))
        or "7" in suffix_lower
        or "9" in suffix_lower
        or "11" in suffix_lower
        or "13" in suffix_lower
    ):
        return FLAT_NOTES
    return SHARP_NOTES


def transpose_note(note: Optional[str], semitones: int) -> Optional[str]:
    if note is None:
        return None
    pitch_class = NOTE_TO_PC.get(note)
    if pitch_class is None:
        return note
    names = FLAT_NOTES if note in FLAT_KEYS or "b" in note else SHARP_NOTES
    return names[(pitch_class + semitones) % 12]


def note_for_interval(root: str, interval: int) -> str:
    root_pc = NOTE_TO_PC.get(root)
    if root_pc is None:
        return root
    names = FLAT_NOTES if root in FLAT_KEYS or "b" in root else SHARP_NOTES
    return names[(root_pc + interval) % 12]


def quality_name_for_suffix(suffix: str) -> str:
    suffix_lower = suffix.lower()
    if not suffix_lower:
        return "Major"
    if suffix_lower.startswith("m7b5"):
        return "Half-diminished seventh"
    if suffix_lower.startswith("dim7"):
        return "Diminished seventh"
    if suffix_lower.startswith("dim"):
        return "Diminished"
    if suffix_lower.startswith("aug7"):
        return "Augmented seventh"
    if suffix_lower.startswith("aug"):
        return "Augmented"
    if suffix_lower.startswith("sus2"):
        return "Suspended second"
    if suffix_lower.startswith("7sus2"):
        return "Dominant seventh suspended second"
    if suffix_lower.startswith("13sus4"):
        return "Dominant thirteenth suspended fourth"
    if suffix_lower.startswith("9sus4"):
        return "Dominant ninth suspended fourth"
    if suffix_lower.startswith("7sus4"):
        return "Dominant seventh suspended fourth"
    if suffix_lower.startswith("sus4") or suffix_lower.startswith("sus"):
        return "Suspended fourth"
    if suffix_lower.startswith("mmaj7"):
        return "Minor major seventh"
    if suffix_lower.startswith("maj13"):
        return "Major thirteenth"
    if suffix_lower.startswith("maj11"):
        return "Major eleventh"
    if suffix_lower.startswith("maj9"):
        return "Major ninth"
    if suffix_lower.startswith("maj7"):
        return "Major seventh"
    if suffix_lower.startswith("m13"):
        return "Minor thirteenth"
    if suffix_lower.startswith("m11"):
        return "Minor eleventh"
    if suffix_lower.startswith("m9"):
        return "Minor ninth"
    if suffix_lower.startswith("m7"):
        return "Minor seventh"
    if suffix_lower.startswith("m6"):
        return "Minor sixth"
    if suffix_lower == "m":
        return "Minor"
    if suffix_lower.startswith("13"):
        return "Dominant thirteenth"
    if suffix_lower.startswith("11"):
        return "Dominant eleventh"
    if suffix_lower.startswith("9"):
        return "Dominant ninth"
    if suffix_lower.startswith("7"):
        return "Dominant seventh"
    if suffix_lower.startswith("6"):
        return "Sixth"
    if suffix_lower == "5":
        return "Power chord"
    return suffix
