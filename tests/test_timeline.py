import unittest

from legacy_desktop.timeline import chord_index_at_position


class TimelineTest(unittest.TestCase):
    def setUp(self):
        self.chords = [
            (0.0, 1.0, "C"),
            (1.0, 2.0, "G7"),
            (2.0, 4.0, "Am7"),
        ]

    def test_position_is_interpreted_as_milliseconds(self):
        self.assertEqual(chord_index_at_position(self.chords, 1500), 1)
        self.assertEqual(chord_index_at_position(self.chords, 2500), 2)

    def test_seek_backward_resets_from_later_index(self):
        self.assertEqual(chord_index_at_position(self.chords, 500, current_index=2), 0)

    def test_position_after_last_chord_returns_end_index(self):
        self.assertEqual(chord_index_at_position(self.chords, 5000), len(self.chords))


if __name__ == "__main__":
    unittest.main()
