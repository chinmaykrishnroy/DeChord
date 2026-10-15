import unittest
import test_backend_audio_service as fixtures
from backend.domain.models import Correction
from backend.engines.chord import build_chord_segment

class RegressionTests(unittest.TestCase):
    setUp = fixtures.BackendAudioServiceTests.setUp
    tearDown = fixtures.BackendAudioServiceTests.tearDown
    def test_partial_correction_preserves_unaffected_time(self):
        result=self.service._apply_corrections([build_chord_segment(0,10,'C')],[Correction(3,5,'G')])
        self.assertEqual([(s.start,s.end,s.label) for s in result],[(0,3,'C'),(3,5,'G'),(5,10,'C')])

if __name__ == '__main__': unittest.main()
