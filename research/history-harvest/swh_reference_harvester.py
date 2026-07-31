#!/usr/bin/env python3
"""Capped Software Heritage snapshot reference harvester.

For each listed GitHub repository origin, sample historical Software Heritage
snapshots and collect branch targets whose target type is a Git revision.
Failures are non-fatal and all work is bounded by an explicit request cap.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

SHA40 = re.compile(r"^[0-9a-fA-F]{40}$")


class StopHarvest(RuntimeError):
    pass


class Client:
    def __init__(self, max_requests: int, delay: float):
        self.max_requests = max_requests
        self.delay = delay
        self.requests = 0
        self.errors = 0

    def get(self, url: str) -> Any:
        if self.requests >= self.max_requests:
            raise StopHarvest("Software Heritage request cap reached")
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "superfluid-history-reference-harvester/1",
            },
        )
        for attempt in range(4):
            if self.requests >= self.max_requests:
                raise StopHarvest("Software Heritage request cap reached")
            if self.requests:
                time.sleep(self.delay)
            try:
                self.requests += 1
                with urllib.request.urlopen(request, timeout=45) as response:
                    return json.load(response)
            except urllib.error.HTTPError as exc:
                self.errors += 1
                if exc.code == 404:
                    return None
                if exc.code in (429, 502, 503, 504):
                    retry_after = exc.headers.get("Retry-After")
                    if retry_after and retry_after.isdigit():
                        time.sleep(min(120, int(retry_after)))
                    else:
                        time.sleep(min(60, 3 * (2 ** attempt)))
                    if exc.code == 429 and attempt == 3:
                        raise StopHarvest("Software Heritage rate limited") from exc
                    continue
                print(f"warning: SWH GET {url}: HTTP {exc.code}", file=sys.stderr)
                return None
            except (urllib.error.URLError, TimeoutError) as exc:
                self.errors += 1
                if attempt < 3:
                    time.sleep(min(30, 2 ** attempt * 2))
                    continue
                print(f"warning: SWH GET {url}: {exc}", file=sys.stderr)
                return None
        return None


def sample_snapshots(visits: list[dict[str, Any]], limit: int) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for visit in sorted(visits, key=lambda v: v.get("date") or ""):
        snapshot = visit.get("snapshot")
        if isinstance(snapshot, str) and SHA40.fullmatch(snapshot) and snapshot not in seen:
            seen.add(snapshot)
            ordered.append(snapshot)
    if len(ordered) <= limit:
        return ordered
    if limit <= 1:
        return [ordered[-1]]
    indexes = {round(i * (len(ordered) - 1) / (limit - 1)) for i in range(limit)}
    return [ordered[i] for i in sorted(indexes)]


def snapshot_pages(client: Client, snapshot: str, max_pages: int = 10):
    branches_from: str | None = None
    for _ in range(max_pages):
        params = {"branches_count": 1000, "target_types": "revision"}
        if branches_from:
            params["branches_from"] = branches_from
        url = (
            f"https://archive.softwareheritage.org/api/1/snapshot/{snapshot}/?"
            + urllib.parse.urlencode(params)
        )
        data = client.get(url)
        if not isinstance(data, dict):
            return
        yield data
        next_branch = data.get("next_branch")
        if not isinstance(next_branch, str) or not next_branch:
            return
        branches_from = next_branch


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repositories", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--max-requests", type=int, default=250)
    parser.add_argument("--delay", type=float, default=0.35)
    parser.add_argument("--snapshots-per-origin", type=int, default=10)
    parser.add_argument("--max-origins", type=int, default=300)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    repositories: list[str] = []
    seen: set[str] = set()
    for line in args.repositories.read_text(encoding="utf-8").splitlines():
        repo = line.strip()
        if not repo or repo.startswith("#") or repo.lower() in seen:
            continue
        if "/" not in repo:
            continue
        seen.add(repo.lower())
        repositories.append(repo)
        if len(repositories) >= args.max_origins:
            break

    client = Client(args.max_requests, args.delay)
    candidate_rows: set[tuple[str, str, str, str]] = set()
    visits_file = (args.out / "visits.jsonl").open("w", encoding="utf-8")
    snapshots_file = (args.out / "snapshots.tsv").open("w", encoding="utf-8")
    snapshots_file.write("repository\tsnapshot\n")
    stopped_reason = "completed"
    processed = 0

    try:
        for repo in repositories:
            origin = f"https://github.com/{repo}"
            url = (
                "https://archive.softwareheritage.org/api/1/origin/"
                + origin
                + "/visits/?per_page=1000"
            )
            visits = client.get(url)
            processed += 1
            if not isinstance(visits, list):
                continue
            visits_file.write(json.dumps({"repository": repo, "visits": visits}) + "\n")
            visits_file.flush()
            for snapshot in sample_snapshots(visits, args.snapshots_per_origin):
                snapshots_file.write(f"{repo}\t{snapshot}\n")
                snapshots_file.flush()
                for page in snapshot_pages(client, snapshot):
                    branches = page.get("branches") or {}
                    if not isinstance(branches, dict):
                        continue
                    for branch_name, branch in branches.items():
                        if not isinstance(branch, dict) or branch.get("target_type") != "revision":
                            continue
                        target = branch.get("target")
                        if isinstance(target, str) and SHA40.fullmatch(target):
                            candidate_rows.add((repo, target.lower(), snapshot, str(branch_name)))
    except StopHarvest as exc:
        stopped_reason = str(exc)
        print(f"warning: {stopped_reason}", file=sys.stderr)
    finally:
        visits_file.close()
        snapshots_file.close()

    with (args.out / "candidates.tsv").open("w", encoding="utf-8") as f:
        f.write("repository\tsha\tsource\tlocator\tremote_hint\n")
        for repo, sha, snapshot, branch in sorted(candidate_rows):
            clean_branch = branch.replace("\t", " ").replace("\n", " ")
            f.write(f"{repo}\t{sha}\tswh.snapshot\t{snapshot}:{clean_branch}\t\n")

    stats = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "origins_requested": processed,
        "origin_limit": args.max_origins,
        "requests": client.requests,
        "request_cap": client.max_requests,
        "errors": client.errors,
        "candidate_rows": len(candidate_rows),
        "stopped_reason": stopped_reason,
    }
    (args.out / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
