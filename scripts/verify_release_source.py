"""Allow publication only from successful CI packages of the exact tagged tree."""

import argparse
import json
import os
import subprocess
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("run_id", type=int)
    args = parser.parse_args()
    repository = os.environ["GITHUB_REPOSITORY"]
    base = f"https://api.github.com/repos/{repository}"

    def api(path):
        request = Request(
            base + path,
            headers={
                "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
                "Accept": "application/vnd.github+json",
            },
        )
        with urlopen(request, timeout=30) as response:
            return json.load(response)

    run = api(f"/actions/runs/{args.run_id}")
    assert run["status"] == "completed" and run["conclusion"] == "success", run[
        "html_url"
    ]
    assert run["head_repository"]["full_name"] == repository
    assert run["path"].split("@", 1)[0] == ".github/workflows/ci.yml"
    assert run["event"] in ("push", "workflow_dispatch")
    sha = run["head_sha"]
    subprocess.run(
        ["git", "merge-base", "--is-ancestor", sha, "origin/main"], check=True
    )
    subprocess.run(["git", "diff", "--exit-code", sha, "HEAD"], check=True)
    jobs = api(f"/actions/runs/{args.run_id}/jobs?per_page=100")["jobs"]
    successful = {job["name"] for job in jobs if job["conclusion"] == "success"}
    expected = {"frontend", "desktop (windows-2022)", "desktop (ubuntu-24.04)"}
    expected |= {
        f"backend ({system}, {version})"
        for system in ("windows-2022", "ubuntu-24.04")
        for version in ("3.10", "3.11")
    }
    expected |= {
        "web-image (ubuntu-24.04, amd64)",
        "web-image (ubuntu-24.04-arm, arm64)",
    }
    assert expected <= successful, sorted(expected - successful)
    artifacts = api(f"/actions/runs/{args.run_id}/artifacts?per_page=100")["artifacts"]
    available = {artifact["name"] for artifact in artifacts if not artifact["expired"]}
    assert {
        "desktop-Windows",
        "desktop-Linux",
        "docker-amd64",
        "docker-arm64",
    } <= available
    print(
        json.dumps(
            {
                "verified_run": args.run_id,
                "tested_commit": sha,
                "tree_matches_tag": True,
            }
        )
    )


if __name__ == "__main__":
    main()
