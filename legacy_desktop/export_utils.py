try:
    from .chord_types import parse_chord_label
except ImportError:
    from chord_types import parse_chord_label


def build_chord_export_rows(chords, format_time):
    rows = []
    for chord in chords:
        start_time, end_time, chord_label = chord
        parsed = parse_chord_label(chord_label)
        rows.append(
            {
                "start": format_time(start_time),
                "end": format_time(end_time),
                "label": parsed.display,
                "quality": parsed.quality_name,
                "notes": " ".join(parsed.notes),
                "bass": parsed.bass or "",
            }
        )
    return rows
