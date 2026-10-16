import unittest

from legacy_desktop.export_utils import build_chord_export_rows


def fake_format_time(seconds):
    return f"{seconds:.1f}s"


class ExportUtilsTest(unittest.TestCase):
    def test_export_rows_include_quality_notes_and_bass(self):
        rows = build_chord_export_rows(
            [
                (0.0, 1.5, "Cmaj7/E"),
                (1.5, 3.0, "Gsus4"),
                (3.0, 4.0, "Eaug"),
            ],
            fake_format_time,
        )

        self.assertEqual(
            rows,
            [
                {
                    "start": "0.0s",
                    "end": "1.5s",
                    "label": "CM7/E",
                    "quality": "Major seventh",
                    "notes": "C E G B",
                    "bass": "E",
                },
                {
                    "start": "1.5s",
                    "end": "3.0s",
                    "label": "Gsus4",
                    "quality": "Suspended fourth",
                    "notes": "G C D",
                    "bass": "",
                },
                {
                    "start": "3.0s",
                    "end": "4.0s",
                    "label": "Eaug",
                    "quality": "Augmented",
                    "notes": "E G# C",
                    "bass": "",
                },
            ],
        )


if __name__ == "__main__":
    unittest.main()
