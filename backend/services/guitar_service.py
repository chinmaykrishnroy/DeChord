"""Duration-weighted capo planning. No audio or GUI work is performed here."""

from collections import OrderedDict
from functools import lru_cache
from itertools import product
from legacy_desktop.chord_types import NOTE_TO_PC, SHARP_NOTES, parse_chord_label

# Relative frets, high e to low E. Familiar shapes are a player preference,
# not a permission to silently simplify the harmony of an extended chord.
OPEN = {
    "A": (0, 2, 2, 2, 0, -1),
    "Am": (0, 1, 2, 2, 0, -1),
    "A7": (0, 2, 0, 2, 0, -1),
    "Am7": (0, 1, 0, 2, 0, -1),
    "AM7": (0, 2, 1, 2, 0, -1),
    "Asus2": (0, 0, 2, 2, 0, -1),
    "Asus4": (0, 3, 2, 2, 0, -1),
    "B7": (2, 0, 2, 1, 2, -1),
    "Bm7": (2, 0, 2, 0, 2, -1),
    "C": (0, 1, 0, 2, 3, -1),
    "C7": (0, 1, 3, 2, 3, -1),
    "CM7": (0, 0, 0, 2, 3, -1),
    "Cadd9": (3, 3, 0, 2, 3, -1),
    "D": (2, 3, 2, 0, -1, -1),
    "Dm": (1, 3, 2, 0, -1, -1),
    "D7": (2, 1, 2, 0, -1, -1),
    "Dm7": (1, 1, 2, 0, -1, -1),
    "DM7": (2, 2, 2, 0, -1, -1),
    "Dsus2": (0, 3, 2, 0, -1, -1),
    "Dsus4": (3, 3, 2, 0, -1, -1),
    "E": (0, 0, 1, 2, 2, 0),
    "Em": (0, 0, 0, 2, 2, 0),
    "E7": (0, 0, 1, 0, 2, 0),
    "Em7": (0, 3, 0, 0, 2, 0),
    "EM7": (0, 0, 1, 1, 2, 0),
    "Esus4": (0, 0, 2, 2, 2, 0),
    "G": (3, 0, 0, 0, 2, 3),
    "G7": (1, 0, 0, 0, 2, 3),
    "GM7": (2, 0, 0, 0, 2, 3),
    "Gsus4": (3, 1, 0, 0, 3, 3),
}
DEFAULT_EASY = ["C", "D", "E", "G", "A", "Am", "Em", "Dm", "A7", "D7", "E7"]


def shape_label(label: str, capo: int) -> str:
    chord = parse_chord_label(label)
    if not chord.root or chord.is_no_chord:
        return "N"
    root = SHARP_NOTES[(NOTE_TO_PC[chord.root] - capo) % 12]
    suffix = chord.suffix.replace("maj", "M")
    bass = "/" + SHARP_NOTES[(NOTE_TO_PC[chord.bass] - capo) % 12] if chord.bass else ""
    return root + suffix + bass


@lru_cache(maxsize=4096)
def shape_cost(label: str, mode: str, capo: int = 0) -> tuple[float, str]:
    chord = parse_chord_label(label)
    if not chord.root:
        return 12, "unavailable"
    root = NOTE_TO_PC[chord.root]
    bass = NOTE_TO_PC[chord.bass] if chord.bass else root
    pcs = {(root + interval) % 12 for interval in chord.intervals} | {bass}
    tuning = (64, 59, 55, 50, 45, 40)
    best = 12.0
    seen = set()

    def consider(frets, curated=False):
        nonlocal best
        if frets in seen:
            return
        seen.add(frets)
        played = [(i, f, tuning[i] + f) for i, f in enumerate(frets) if f >= 0]
        if len(played) < 3:
            return
        if {midi % 12 for _, _, midi in played} != pcs:
            return
        if min(midi for _, _, midi in played) % 12 != bass:
            return
        pressed = [(i, f) for i, f, _ in played if f > 0]
        low = min((f for _, f in pressed), default=0)
        high = max((f for _, f in pressed), default=0)
        if high - low > 3 or high + capo > 15:
            return
        base_strings = [i for i, f in pressed if f == low]
        barre = (
            len(pressed) > 4
            and len(base_strings) >= 2
            and all(f >= low for f in frets[min(base_strings) : max(base_strings) + 1])
        )
        groups = len(pressed) - (len(base_strings) - 1 if barre else 0)
        if groups > 4 or ("barre" if barre else "open") != mode:
            return
        opens = sum(f == 0 for _, f, _ in played)
        mutes = sum(f < 0 for f in frets[played[0][0] : played[-1][0] + 1])
        cost = (
            groups * 0.48
            + (high - low) * 0.33
            + high * 0.08
            + (1.35 if barre else 0)
            + mutes * 1.5
            + (6 - len(played)) * 0.12
            - opens * 0.12
            - (0.65 if curated else 0)
        )
        best = min(best, max(1.0, cost))

    if label in OPEN:
        consider(OPEN[label], True)
    for base in range(1, 10):
        options = [
            tuple(
                [-1]
                + [
                    f
                    for f in range(base, base + 4)
                    if f + capo <= 15 and (note + f) % 12 in pcs
                ]
                + ([0] if note % 12 in pcs else [])
            )
            for note in tuning
        ]
        for frets in product(*options):
            consider(frets)
    return best, mode if best < 12 else "unavailable"


def plan_capo(
    chords: list[dict],
    easy_shapes: list[str] | None = None,
    mode: str = "open",
    capo: int | None = None,
    max_capo: int = 7,
) -> dict:
    weights: OrderedDict[str, float] = OrderedDict()
    for item in chords:
        parsed = parse_chord_label(item["label"])
        if parsed.root and not parsed.is_no_chord:
            weights[item["label"]] = weights.get(item["label"], 0) + max(
                0.05, item["duration"]
            )
    easy = {
        shape_label(label, 0)
        for label in (DEFAULT_EASY if easy_shapes is None else easy_shapes)
    }
    candidates = []
    for position in [capo] if capo is not None else range(max_capo + 1):
        details = []
        for label, weight in weights.items():
            shape = shape_label(label, position)
            cost, family = shape_cost(shape, mode, position)
            familiar = shape in easy and family != "unavailable"
            # User familiarity dominates minor ergonomic and capo-height costs.
            difficulty = cost + (0 if familiar else 4)
            details.append(
                {
                    "chord": label,
                    "shape": shape,
                    "easy": familiar,
                    "family": family,
                    "difficulty": round(difficulty, 3),
                    "duration": weight,
                }
            )
        total_weight = sum(weights.values()) or 1
        score = (
            sum(d["difficulty"] * d["duration"] for d in details) / total_weight
            + position * 0.035
        )
        candidates.append(
            {
                "capo": position,
                "score": round(score, 4),
                "mode": mode,
                "easy_count": sum(d["easy"] for d in details),
                "total_count": len(details),
                "shape_labels": [d["shape"] for d in details],
                "chords": details,
            }
        )
    best = min(candidates, key=lambda row: (row["score"], row["capo"]))
    return {
        **best,
        "automatic": capo is None,
        "alternatives": [
            {key: row[key] for key in ("capo", "score", "easy_count")}
            for row in sorted(candidates, key=lambda row: row["score"])
        ],
    }
