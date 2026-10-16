"""Reject unverified or mismatched packages at the publication boundary."""

from contextlib import redirect_stdout
import io
import json
import os
import subprocess
import unittest
from unittest.mock import patch

from scripts import verify_release_source


class ReleaseSourceTests(unittest.TestCase):
    def setUp(self):
        self.run_info = {
            "status": "completed",
            "conclusion": "success",
            "html_url": "https://example.invalid/run",
            "head_repository": {"full_name": "owner/dechord"},
            "path": ".github/workflows/ci.yml",
            "event": "push",
            "head_sha": "a" * 40,
        }
        names = ["frontend", "desktop (windows-2022)", "desktop (ubuntu-24.04)"]
        names += [
            f"backend ({system}, {version})"
            for system in ("windows-2022", "ubuntu-24.04")
            for version in ("3.10", "3.11")
        ]
        names += [
            "web-image (ubuntu-24.04, amd64)",
            "web-image (ubuntu-24.04-arm, arm64)",
        ]
        self.jobs = [{"name": name, "conclusion": "success"} for name in names]
        self.artifacts = [
            {"name": name, "expired": False}
            for name in (
                "desktop-Windows",
                "desktop-Linux",
                "docker-amd64",
                "docker-arm64",
            )
        ]

    def invoke(self, git_error=False):
        def response(request, timeout):
            if "/jobs?" in request.full_url:
                data = {"jobs": self.jobs}
            elif "/artifacts?" in request.full_url:
                data = {"artifacts": self.artifacts}
            else:
                data = self.run_info
            return io.BytesIO(json.dumps(data).encode())

        environment = {"GITHUB_REPOSITORY": "owner/dechord", "GH_TOKEN": "test-only"}
        output = io.StringIO()
        with (
            patch.dict(os.environ, environment),
            patch("sys.argv", ["verify_release_source.py", "123"]),
            patch.object(verify_release_source, "urlopen", side_effect=response),
            patch.object(verify_release_source.subprocess, "run") as git,
            redirect_stdout(output),
        ):
            if git_error:
                git.side_effect = [None, subprocess.CalledProcessError(1, "git diff")]
            verify_release_source.main()
        return output.getvalue()

    def test_successful_exact_tree_and_all_platforms_are_accepted(self):
        self.assertTrue(json.loads(self.invoke())["tree_matches_tag"])

    def test_foreign_repository_is_rejected(self):
        self.run_info["head_repository"]["full_name"] = "someone/else"
        with self.assertRaises(AssertionError):
            self.invoke()

    def test_missing_platform_gate_is_rejected(self):
        self.jobs = [
            job for job in self.jobs if job["name"] != "desktop (windows-2022)"
        ]
        with self.assertRaises(AssertionError):
            self.invoke()

    def test_different_source_tree_is_rejected(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.invoke(git_error=True)


if __name__ == "__main__":
    unittest.main()
