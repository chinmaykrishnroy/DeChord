"""Lock the separate app, setup and uninstaller icon contracts."""

import json
from pathlib import Path
import struct
import unittest


class PackagingBrandingTests(unittest.TestCase):
    def test_installer_and_uninstaller_use_the_application_icon(self):
        root = Path(__file__).resolve().parents[1] / "frontend/src-tauri"
        config = json.loads((root / "tauri.conf.json").read_text())
        nsis = config["bundle"]["windows"]["nsis"]
        for name in ("installerIcon", "uninstallerIcon"):
            self.assertEqual(nsis[name], "icons/icon.ico")
            data = (root / nsis[name]).read_bytes()
            reserved, kind, count = struct.unpack_from("<HHH", data)
            self.assertEqual((reserved, kind), (0, 1))
            sizes = {data[6 + index * 16] or 256 for index in range(count)}
            self.assertTrue({16, 32}.issubset(sizes))
        self.assertTrue((root / nsis["installerHooks"]).is_file())


if __name__ == "__main__":
    unittest.main()
