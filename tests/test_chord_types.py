import unittest

from chord_types import chord_details_text, chord_notes, normalize_chord_label, parse_chord_label, transpose_chord_label


class ChordTypesTest(unittest.TestCase):
    def test_normalizes_madmom_major_and_minor_labels(self):
        self.assertEqual(normalize_chord_label("C:maj"), "C")
        self.assertEqual(normalize_chord_label("D:min"), "Dm")

    def test_preserves_extended_chord_types(self):
        self.assertEqual(normalize_chord_label("F#:maj7/A#"), "F#M7/A#")
        self.assertEqual(normalize_chord_label("Bb:min7"), "Bbm7")
        self.assertEqual(normalize_chord_label("G:hdim7"), "Gm7b5")
        self.assertEqual(normalize_chord_label("C13b9"), "C13b9")
        self.assertEqual(normalize_chord_label("E:aug"), "Eaug")
        self.assertEqual(normalize_chord_label("A:sus"), "Asus4")
        self.assertEqual(normalize_chord_label("E:maj/2"), "E/F#")
        self.assertEqual(normalize_chord_label("C:sus4(b7)"), "C7sus4")

    def test_no_chord_labels(self):
        self.assertEqual(normalize_chord_label("N"), "N")
        self.assertTrue(parse_chord_label("no chord").is_no_chord)

    def test_simple_display_collapses_extensions(self):
        self.assertEqual(normalize_chord_label("Cmaj7", display_mode="simple"), "C")
        self.assertEqual(normalize_chord_label("Dm9", display_mode="simple"), "Dm")
        self.assertEqual(normalize_chord_label("Fsus4", display_mode="simple"), "Fsus4")

    def test_notes_for_advanced_qualities(self):
        self.assertEqual(chord_notes("C7"), ["C", "E", "G", "Bb"])
        self.assertEqual(chord_notes("Cmaj7"), ["C", "E", "G", "B"])
        self.assertEqual(chord_notes("Dm7"), ["D", "F", "A", "C"])
        self.assertEqual(chord_notes("Fsus4"), ["F", "Bb", "C"])
        self.assertEqual(chord_notes("Eaug"), ["E", "G#", "C"])
        self.assertEqual(chord_notes("Bm7b5"), ["B", "D", "F", "A"])
        self.assertEqual(chord_notes("C13b9"), ["C", "E", "G", "Bb", "F", "A", "Db"])
        self.assertEqual(chord_notes("C7sus4"), ["C", "F", "G", "Bb"])

    def test_flat_roots_keep_flat_note_names(self):
        self.assertEqual(chord_notes("Bb7"), ["Bb", "D", "F", "Ab"])

    def test_details_include_quality_notes_and_bass(self):
        self.assertEqual(
            chord_details_text("Cmaj7/E"),
            "Major seventh | Notes: C E G B | Bass: E",
        )

    def test_transpose_preserves_quality_and_slash_bass(self):
        self.assertEqual(transpose_chord_label("Cmaj7/E", 2), "DM7/F#")
        self.assertEqual(transpose_chord_label("Bbm7", 2), "Cm7")


if __name__ == "__main__":
    unittest.main()
