#!/usr/bin/env python3
"""Quota-aware GitHub reference harvester for public repository history recovery.

It does not download Git objects. It gathers repository/fork identities and commit
SHAs from GitHub metadata so a later mirror step can fetch current refs and try
addressed fetches for older objects.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator

SHA40 = re.compile(r"(?<![0-9a-fA-F])[0-9a-fA-F]{40}(?![0-9a-fA-F])")
GITHUB_COMMIT_URL = re.compile(
    r"https?://github\.com/([^/\s]+/[^/\s]+)/(?:commit|tree|blob)/([0-9a-fA-F]{7,40})"
)


class QuotaLow(RuntimeError):
    pass


@dataclass
class Candidate:
    repository: str
    sha: str
    source: str
    locator: str
    remote_hint: str = ""


class GitHubAPI:
    def __init__(self, token: str, cache_dir: Path, rate_floor: int, resume_path: Path):
        self.token = token
        self.cache_dir = cache_dir
        self.rate_floor = rate_floor
        self.resume_path = resume_path
        self.remaining: int | None = None
        self.limit: int | None = None
        self.reset: int | None = None
        self.requests = 0
        self.cache_hits = 0
        cache_dir.mkdir(parents=True, exist_ok=True)
        resume_path.parent.mkdir(parents=True, exist_ok=True)

    def _cache_path(self, url: str) -> Path:
        return self.cache_dir / f"{hashlib.sha256(url.encode()).hexdigest()}.json"

    def _record_resume(self, url: str, reason: str) -> None:
        with self.resume_path.open("a", encoding="utf-8") as f:
            f.write(f"{reason}\t{url}\n")

    def _update_rate(self, headers: Any) -> None:
        for attr, header in (
            ("remaining", "X-RateLimit-Remaining"),
            ("limit", "X-RateLimit-Limit"),
            ("reset", "X-RateLimit-Reset"),
        ):
            value = headers.get(header)
            if value is not None:
                try:
                    setattr(self, attr, int(value))
                except ValueError:
                    pass

    def get(self, path: str, params: dict[str, Any] | None = None, *, cache: bool = True) -> Any:
        if self.remaining is not None and self.remaining <= self.rate_floor:
            url = self._url(path, params)
            self._record_resume(url, "rate-floor")
            raise QuotaLow(f"GitHub API quota floor reached: {self.remaining}")

        url = self._url(path, params)
        cache_path = self._cache_path(url)
        if cache and cache_path.exists():
            self.cache_hits += 1
            return json.loads(cache_path.read_text(encoding="utf-8"))

        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "superfluid-history-reference-harvester/1",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        for attempt in range(5):
            request = urllib.request.Request(url, headers=headers)
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    self.requests += 1
                    self._update_rate(response.headers)
                    data = json.load(response)
                    if cache:
                        cache_path.write_text(json.dumps(data), encoding="utf-8")
                    return data
            except urllib.error.HTTPError as exc:
                self.requests += 1
                self._update_rate(exc.headers)
                body = exc.read(2048).decode("utf-8", "replace")
                if exc.code in (403, 429):
                    if self.remaining == 0 and self.reset:
                        self._record_resume(url, f"http-{exc.code}-rate-limit")
                        raise QuotaLow(
                            f"GitHub rate limit exhausted; reset at {self.reset}: {url}"
                        ) from exc
                    wait = min(60, 2 ** attempt * 3)
                    time.sleep(wait)
                    continue
                if exc.code in (404, 409, 422):
                    return None
                if 500 <= exc.code < 600 and attempt < 4:
                    time.sleep(min(30, 2 ** attempt * 2))
                    continue
                print(f"warning: GET {url}: HTTP {exc.code}: {body}", file=sys.stderr)
                return None
            except (urllib.error.URLError, TimeoutError) as exc:
                if attempt < 4:
                    time.sleep(min(30, 2 ** attempt * 2))
                    continue
                print(f"warning: GET {url}: {exc}", file=sys.stderr)
                self._record_resume(url, "network-error")
                return None
        return None

    @staticmethod
    def _url(path: str, params: dict[str, Any] | None) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            base = path
        else:
            base = "https://api.github.com" + (path if path.startswith("/") else "/" + path)
        if not params:
            return base
        return base + "?" + urllib.parse.urlencode(params)

    def paginate(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        *,
        item_key: str | None = None,
        max_pages: int = 100,
    ) -> Iterator[Any]:
        base_params = dict(params or {})
        base_params.setdefault("per_page", 100)
        for page in range(1, max_pages + 1):
            page_params = dict(base_params)
            page_params["page"] = page
            data = self.get(path, page_params)
            if data is None:
                return
            if item_key:
                items = data.get(item_key, []) if isinstance(data, dict) else []
            else:
                items = data if isinstance(data, list) else []
            if not items:
                return
            for item in items:
                yield item
            if len(items) < int(base_params["per_page"]):
                return


def text_shas(value: Any) -> Iterable[str]:
    if not isinstance(value, str):
        return ()
    return (match.group(0).lower() for match in SHA40.finditer(value))


def add_candidate(
    candidates: dict[tuple[str, str, str, str, str], Candidate],
    repository: str,
    sha: Any,
    source: str,
    locator: str,
    remote_hint: str = "",
) -> None:
    if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-fA-F]{40}", sha):
        return
    candidate = Candidate(repository, sha.lower(), source, locator, remote_hint)
    key = (
        candidate.repository,
        candidate.sha,
        candidate.source,
        candidate.locator,
        candidate.remote_hint,
    )
    candidates[key] = candidate


def scan_text(
    candidates: dict[tuple[str, str, str, str, str], Candidate],
    repository: str,
    text: Any,
    source: str,
    locator: str,
) -> None:
    if not isinstance(text, str):
        return
    for sha in text_shas(text):
        add_candidate(candidates, repository, sha, source, locator)
    for match in GITHUB_COMMIT_URL.finditer(text):
        repo_hint, abbreviated = match.groups()
        if len(abbreviated) == 40:
            add_candidate(
                candidates,
                repo_hint,
                abbreviated,
                f"{source}:github-url",
                locator,
                repo_hint,
            )


def harvest_repo(
    api: GitHubAPI,
    repo: dict[str, Any],
    candidates: dict[tuple[str, str, str, str, str], Candidate],
    forks_writer: Any,
    max_fork_depth: int,
    max_forks_per_root: int,
) -> None:
    full_name = repo["full_name"]
    print(f"harvest: {full_name}", file=sys.stderr)

    for pr in api.paginate(
        f"/repos/{full_name}/pulls",
        {"state": "all", "sort": "created", "direction": "asc"},
        max_pages=100,
    ):
        number = pr.get("number", "?")
        head = pr.get("head") or {}
        base = pr.get("base") or {}
        head_repo = ((head.get("repo") or {}).get("full_name") or "")
        add_candidate(candidates, full_name, head.get("sha"), "pull.head", f"pr:{number}", head_repo)
        add_candidate(candidates, full_name, base.get("sha"), "pull.base", f"pr:{number}")
        add_candidate(candidates, full_name, pr.get("merge_commit_sha"), "pull.merge", f"pr:{number}")
        scan_text(candidates, full_name, pr.get("body"), "pull.body", f"pr:{number}")

    for comment in api.paginate(
        f"/repos/{full_name}/pulls/comments",
        {"sort": "created", "direction": "asc"},
        max_pages=100,
    ):
        cid = comment.get("id", "?")
        add_candidate(candidates, full_name, comment.get("commit_id"), "review-comment.commit", f"review-comment:{cid}")
        add_candidate(candidates, full_name, comment.get("original_commit_id"), "review-comment.original", f"review-comment:{cid}")
        scan_text(candidates, full_name, comment.get("body"), "review-comment.body", f"review-comment:{cid}")

    for comment in api.paginate(f"/repos/{full_name}/comments", max_pages=50):
        cid = comment.get("id", "?")
        add_candidate(candidates, full_name, comment.get("commit_id"), "commit-comment", f"commit-comment:{cid}")
        scan_text(candidates, full_name, comment.get("body"), "commit-comment.body", f"commit-comment:{cid}")

    for comment in api.paginate(
        f"/repos/{full_name}/issues/comments",
        {"sort": "created", "direction": "asc"},
        max_pages=50,
    ):
        cid = comment.get("id", "?")
        scan_text(candidates, full_name, comment.get("body"), "issue-comment.body", f"issue-comment:{cid}")

    for run in api.paginate(
        f"/repos/{full_name}/actions/runs",
        max_pages=50,
        item_key="workflow_runs",
    ):
        rid = run.get("id", "?")
        add_candidate(candidates, full_name, run.get("head_sha"), "actions.head", f"run:{rid}")
        for pr in run.get("pull_requests") or []:
            add_candidate(candidates, full_name, ((pr.get("head") or {}).get("sha")), "actions.pr-head", f"run:{rid}")
            add_candidate(candidates, full_name, ((pr.get("base") or {}).get("sha")), "actions.pr-base", f"run:{rid}")

    for deployment in api.paginate(f"/repos/{full_name}/deployments", max_pages=50):
        did = deployment.get("id", "?")
        add_candidate(candidates, full_name, deployment.get("sha"), "deployment.sha", f"deployment:{did}")
        scan_text(candidates, full_name, deployment.get("ref"), "deployment.ref", f"deployment:{did}")
        scan_text(candidates, full_name, deployment.get("description"), "deployment.description", f"deployment:{did}")
        scan_text(candidates, full_name, json.dumps(deployment.get("payload")), "deployment.payload", f"deployment:{did}")

    for release in api.paginate(f"/repos/{full_name}/releases", max_pages=20):
        rid = release.get("id", "?")
        scan_text(candidates, full_name, release.get("body"), "release.body", f"release:{rid}")
        scan_text(candidates, full_name, release.get("target_commitish"), "release.target", f"release:{rid}")

    for event in api.paginate(f"/repos/{full_name}/events", max_pages=3):
        eid = event.get("id", "?")
        payload = event.get("payload") or {}
        for field in ("before", "head", "after"):
            add_candidate(candidates, full_name, payload.get(field), f"event.{field}", f"event:{eid}")
        for commit in payload.get("commits") or []:
            add_candidate(candidates, full_name, commit.get("sha"), "event.commit", f"event:{eid}")
        scan_text(candidates, full_name, json.dumps(payload), "event.payload", f"event:{eid}")

    seen = {full_name.lower()}
    queue: deque[tuple[str, int]] = deque([(full_name, 0)])
    written = 0
    while queue and written < max_forks_per_root:
        parent, depth = queue.popleft()
        if depth >= max_fork_depth:
            continue
        for fork in api.paginate(f"/repos/{parent}/forks", {"sort": "oldest"}, max_pages=100):
            fork_name = fork.get("full_name")
            if not fork_name or fork_name.lower() in seen:
                continue
            seen.add(fork_name.lower())
            written += 1
            forks_writer.write(
                "\t".join(
                    [
                        full_name,
                        parent,
                        fork_name,
                        str(depth + 1),
                        fork.get("clone_url") or f"https://github.com/{fork_name}.git",
                        str(fork.get("size") or 0),
                        fork.get("pushed_at") or "",
                        "1" if fork.get("archived") else "0",
                    ]
                )
                + "\n"
            )
            if int(fork.get("forks_count") or 0) > 0 and depth + 1 < max_fork_depth:
                queue.append((fork_name, depth + 1))
            if written >= max_forks_per_root:
                return


def write_outputs(
    out: Path,
    repos: list[dict[str, Any]],
    candidates: dict[tuple[str, str, str, str, str], Candidate],
    api: GitHubAPI,
) -> None:
    (out / "repositories.json").write_text(json.dumps(repos, indent=2), encoding="utf-8")
    (out / "repositories.txt").write_text("".join(f"{repo['full_name']}\n" for repo in repos), encoding="utf-8")
    with (out / "candidates.tsv").open("w", encoding="utf-8") as f:
        f.write("repository\tsha\tsource\tlocator\tremote_hint\n")
        for candidate in sorted(candidates.values(), key=lambda c: (c.repository.lower(), c.sha, c.source, c.locator, c.remote_hint)):
            f.write(
                "\t".join(
                    [
                        candidate.repository,
                        candidate.sha,
                        candidate.source.replace("\t", " "),
                        candidate.locator.replace("\t", " "),
                        candidate.remote_hint,
                    ]
                )
                + "\n"
            )
    stats = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "api_requests": api.requests,
        "cache_hits": api.cache_hits,
        "rate_limit": api.limit,
        "rate_remaining": api.remaining,
        "rate_reset": api.reset,
        "repositories": len(repos),
        "candidate_rows": len(candidates),
        "unique_candidate_shas": len({c.sha for c in candidates.values()}),
    }
    (out / "api-stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--rate-floor", type=int, default=300)
    parser.add_argument("--max-fork-depth", type=int, default=4)
    parser.add_argument("--max-forks-per-root", type=int, default=2000)
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    api = GitHubAPI(token, args.cache, args.rate_floor, args.out / "resume-queue.tsv")
    candidates: dict[tuple[str, str, str, str, str], Candidate] = {}

    try:
        rate = api.get("/rate_limit", cache=False)
        if isinstance(rate, dict):
            core = ((rate.get("resources") or {}).get("core") or {})
            api.remaining = core.get("remaining", api.remaining)
            api.limit = core.get("limit", api.limit)
            api.reset = core.get("reset", api.reset)
    except QuotaLow:
        pass

    repos: list[dict[str, Any]] = []
    try:
        repos = list(
            api.paginate(
                f"/orgs/{args.org}/repos",
                {"type": "public", "sort": "full_name", "direction": "asc"},
                max_pages=20,
            )
        )
    except QuotaLow as exc:
        print(f"warning: {exc}", file=sys.stderr)

    with (args.out / "forks.tsv").open("w", encoding="utf-8") as forks_writer:
        forks_writer.write("root_repository\tparent_repository\tfork_repository\tdepth\tclone_url\tsize_kb\tpushed_at\tarchived\n")
        for repo in repos:
            try:
                harvest_repo(
                    api,
                    repo,
                    candidates,
                    forks_writer,
                    args.max_fork_depth,
                    args.max_forks_per_root,
                )
                forks_writer.flush()
            except QuotaLow as exc:
                print(f"warning: {exc}; stopping cleanly", file=sys.stderr)
                break
            except Exception as exc:
                print(f"warning: harvest failed for {repo.get('full_name')}: {exc}", file=sys.stderr)
                with (args.out / "errors.log").open("a", encoding="utf-8") as f:
                    f.write(f"{repo.get('full_name')}\t{type(exc).__name__}\t{exc}\n")

    write_outputs(args.out, repos, candidates, api)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
