#!/usr/bin/env python3
"""Aggregate sanitized per-repository history scan reports and recovery metadata."""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HIGH_PRIORITY_SERVICES = {
    "CMS/Payload/Auth",
    "Trigger.dev",
    "Vercel/Blob",
    "Database/credentialed service",
    "Redis/Upstash",
    "Email SaaS",
    "Signer/relayer/private key",
    "GitHub",
    "AWS",
    "Cloudflare",
    "Sentry",
    "Internal SaaS/observability",
    "Superfluid Platform API",
}


def tsv_counts(path: Path, column: str) -> Counter[str]:
    counts: Counter[str] = Counter()
    if not path.exists():
        return counts
    with path.open(newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            counts[row.get(column) or ""] += 1
    return counts


def copy_safe_metadata(root: Path, output: Path) -> None:
    safe_meta = output / "harvest-meta"
    safe_meta.mkdir(parents=True, exist_ok=True)
    for relative in (
        "meta/candidate-fetch-results.tsv",
        "meta/fork-fetch-results.tsv",
        "meta/repository-counts.tsv",
        "meta/github/api-stats.json",
        "meta/swh/stats.json",
        "meta/github/forks.tsv",
        "meta/candidates.tsv",
    ):
        source = root / relative
        if source.exists():
            (safe_meta / source.name).write_bytes(source.read_bytes())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reports", type=Path, required=True)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    repository_reports: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    for path in sorted(args.reports.glob("*.safe.json")):
        report = json.loads(path.read_text(encoding="utf-8"))
        repository_reports.append(
            {
                "repository": report["repository"],
                "default_branch": report["default_branch"],
                "finding_count": report["finding_count"],
            }
        )
        findings.extend(report["findings"])

    candidate_results = tsv_counts(args.root / "meta" / "candidate-fetch-results.tsv", "result")
    fork_results = tsv_counts(args.root / "meta" / "fork-fetch-results.tsv", "result")
    scope_counts = Counter(item["scope"] for item in findings)
    recovered = [item for item in findings if item["scope"] == "recovered-reference"]
    high_priority = [
        item
        for item in findings
        if item["service"] in HIGH_PRIORITY_SERVICES and not item["obvious_placeholder"]
    ]

    aggregate = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "workflow_run_id": int(args.run_id),
        "repositories_reported": len(repository_reports),
        "repository_reports": repository_reports,
        "finding_count": len(findings),
        "counts_by_rule": dict(Counter(item["rule_id"] for item in findings)),
        "counts_by_service": dict(Counter(item["service"] for item in findings)),
        "counts_by_repository": dict(Counter(item["repository"] for item in findings)),
        "counts_by_scope": dict(scope_counts),
        "candidate_fetch_results": dict(candidate_results),
        "fork_fetch_results": dict(fork_results),
        "recovered_reference_finding_count": len(recovered),
        "high_priority_nonplaceholder_count": len(high_priority),
        "high_priority_nonplaceholder_findings": high_priority,
        "recovered_reference_findings": recovered,
        "all_findings": findings,
        "method": {
            "harvest": "GitHub metadata, recursive surviving forks, detached PR repositories, deployments, Actions runs, comments, releases, recent events, and capped Software Heritage snapshots.",
            "recovery": "Mirrored organization refs plus fork/detached refs and addressed SHA fetches stored under refs/recovered.",
            "scan": "Verified Gitleaks 8.30.1 default rules plus current-service rules, with --log-opts=--all after recovery.",
            "credential_testing": "None.",
            "redaction": "No raw credential value is retained in this artifact.",
        },
    }

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "superfluid-org-harvest-integrated-secret-scan.json").write_text(
        json.dumps(aggregate, indent=2), encoding="utf-8"
    )
    (args.output / "summary.txt").write_text(
        "\n".join(
            [
                f"Repositories: {len(repository_reports)}",
                f"Findings: {len(findings)}",
                f"Recovered-reference findings: {len(recovered)}",
                f"High-priority non-placeholder candidates: {len(high_priority)}",
                f"Candidate fetch results: {dict(candidate_results)}",
                f"Fork fetch results: {dict(fork_results)}",
                f"Counts by service: {dict(Counter(item['service'] for item in findings))}",
                "",
            ]
        ),
        encoding="utf-8",
    )
    copy_safe_metadata(args.root, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
