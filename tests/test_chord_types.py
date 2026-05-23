import unittest

from chord_types import normalize_chord_label, parse_chord_label


class ChordTypesTest(unittest.TestCase):
    def test_normalizes_madmom_major_and_minor_labels(self):
        self.assertEqual(normalize_chord_label("C:maj"), "C")
        self.assertEqual(normalize_chord_label("D:min"), "Dm")

    def test_preserves_extended_chord_types(self):
        self.assertEqual(normalize_chord_label("F#:maj7/A#"), "F#maj7/A#")
        self.assertEqual(normalize_chord_label("Bb:min7"), "Bbm7")
        self.assertEqual(normalize_chord_label("G:hdim7"), "Gm7b5")
        self.assertEqual(normalize_chord_label("C13b9"), "C13b9")

    def test_no_chord_labels(self):
        self.assertEqual(normalize_chord_label("N"), "N")
        self.assertTrue(parse_chord_label("no chord").is_no_chord)

    def test_simple_display_collapses_extensions(self):
        self.assertEqual(normalize_chord_label("Cmaj7", display_mode="simple"), "C")
        self.assertEqual(normalize_chord_label("Dm9", display_mode="simple"), "Dm")
        self.assertEqual(normalize_chord_label("Fsus4", display_mode="simple"), "Fsus4")


if __name__ == "__main__":
    unittest.main()
