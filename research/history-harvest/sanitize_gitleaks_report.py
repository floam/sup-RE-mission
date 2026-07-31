#!/usr/bin/env python3
"""Convert one raw Gitleaks report into a value-free, fingerprinted audit report."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

PLACEHOLDER_TERMS = (
    "your-", "your_", "your ", "example", "placeholder", "changeme",
    "change_me", "dummy", "sample", "redacted", "replace", "insert",
    "process.env", "import.meta.env", "${", "{{", "secrets.", "<secret",
    "<token", "<key", "not-production", "not_production", "localhost",
)

HIGH_VALUE_RULES = {
    "superfluid-platform-api-key", "trigger-dev-key", "vercel-blob-token",
    "alchemy-rpc-key", "infura-rpc-key", "quicknode-rpc-key",
    "credentialed-service-url", "cms-auth-secret-assignment",
    "trigger-secret-assignment", "vercel-secret-assignment",
    "database-secret-assignment", "redis-secret-assignment",
    "email-secret-assignment", "signer-private-key-assignment",
    "rpc-indexer-secret-assignment", "cloud-ci-secret-assignment",
    "internal-saas-secret-assignment", "github-pat", "github-fine-grained-pat",
    "stripe-access-token", "slack-webhook-url", "aws-access-token",
    "private-key", "jwt",
}


def run_git(bare: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(bare), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )


def value_shape(secret: str) -> str:
    if re.fullmatch(r"0x[0-9a-fA-F]+", secret):
        return f"0x-hex/{len(secret) - 2}"
    if re.fullmatch(r"[0-9a-fA-F]+", secret):
        return f"hex/{len(secret)}"
    if re.fullmatch(r"[A-Za-z0-9_-]+", secret):
        return f"base64url-like/{len(secret)}"
    if "://" in secret:
        return f"url/{len(secret)}"
    if " " in secret:
        return f"words/{len(secret.split())}"
    return f"mixed/{len(secret)}"


def file_context(path: str) -> str:
    lowered = path.lower()
    if any(x in lowered for x in ("node_modules/", "/vendor/", "/lib/forge-std", "/lib/openzeppelin")):
        return "vendored"
    if any(x in lowered for x in ("test", "fixture", "mock", "example", "sample", "demo", "hardhat", "anvil", "foundry")):
        return "test/example"
    if any(x in lowered for x in ("readme", "docs/", "documentation")):
        return "documentation"
    if any(x in lowered for x in (".github/workflows", "docker-compose", "compose.", "k8s/", "helm/", "terraform", "vercel.json")):
        return "deployment/config"
    if ".env" in lowered or lowered.endswith((".yaml", ".yml", ".toml", ".ini", ".conf", ".json")):
        return "configuration"
    return "source"


def service(rule: str) -> str:
    lowered = rule.lower()
    groups = [
        (("payload", "cms-auth"), "CMS/Payload/Auth"),
        (("trigger",), "Trigger.dev"),
        (("vercel", "blob-token"), "Vercel/Blob"),
        (("database", "postgres", "neon", "credentialed-service-url"), "Database/credentialed service"),
        (("redis", "upstash"), "Redis/Upstash"),
        (("email-", "sendgrid", "mailgun", "postmark", "resend", "smtp"), "Email SaaS"),
        (("signer", "private-key", "private_key", "mnemonic", "keystore", "relayer"), "Signer/relayer/private key"),
        (("alchemy",), "Alchemy RPC"),
        (("infura",), "Infura RPC"),
        (("quicknode",), "QuickNode RPC"),
        (("rpc-indexer", "goldsky", "the-graph", "coingecko"), "Indexer/market-data SaaS"),
        (("github",), "GitHub"),
        (("npm",), "npm registry"),
        (("aws",), "AWS"),
        (("cloudflare",), "Cloudflare"),
        (("sentry",), "Sentry"),
        (("stripe",), "Stripe"),
        (("windmill", "grafana", "loki", "tempo", "prometheus", "alertmanager", "internal-saas"), "Internal SaaS/observability"),
        (("superfluid-platform",), "Superfluid Platform API"),
    ]
    for needles, label in groups:
        if any(needle in lowered for needle in needles):
            return label
    return "Other detector"


def read_candidate_sources(path: Path, repository: str) -> dict[str, list[dict[str, str | None]]]:
    result: dict[str, list[dict[str, str | None]]] = defaultdict(list)
    if not path.exists():
        return result
    with path.open(newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            if row.get("repository") != repository:
                continue
            sha = row.get("sha") or ""
            if not sha:
                continue
            result[sha].append(
                {
                    "source": row.get("source") or None,
                    "result": row.get("result") or None,
                    "remote_hint": row.get("remote_hint") or None,
                }
            )
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True)
    parser.add_argument("--bare", type=Path, required=True)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--candidate-fetch-results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    rows: list[dict[str, Any]] = []
    if args.raw.exists() and args.raw.stat().st_size:
        rows = json.loads(args.raw.read_text(encoding="utf-8", errors="replace"))

    default_ref = run_git(args.bare, "symbolic-ref", "HEAD").stdout.strip()
    default_branch = default_ref.removeprefix("refs/heads/") if default_ref else ""
    candidate_sources = read_candidate_sources(args.candidate_fetch_results, args.repository)

    ancestor_cache: dict[str, bool] = {}
    refs_cache: dict[str, list[str]] = {}

    def on_default(commit: str) -> bool | None:
        if not commit or not default_branch:
            return None
        if commit not in ancestor_cache:
            ancestor_cache[commit] = subprocess.run(
                ["git", "-C", str(args.bare), "merge-base", "--is-ancestor", commit, f"refs/heads/{default_branch}"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).returncode == 0
        return ancestor_cache[commit]

    def containing_refs(commit: str, rule: str) -> list[str]:
        if not commit or rule not in HIGH_VALUE_RULES:
            return []
        if commit not in refs_cache:
            proc = run_git(
                args.bare,
                "for-each-ref", "--contains", commit, "--format=%(refname)",
                "refs/heads", "refs/tags", "refs/pull", "refs/notes", "refs/recovered",
            )
            refs_cache[commit] = proc.stdout.splitlines()[:250] if proc.returncode == 0 else []
        return refs_cache[commit]

    findings: list[dict[str, Any]] = []
    for row in rows:
        secret = str(row.get("Secret") or row.get("Match") or "")
        rule = str(row.get("RuleID") or "")
        commit = str(row.get("Commit") or "")
        path = str(row.get("File") or "")
        refs = containing_refs(commit, rule)
        default_history = on_default(commit)
        recovered_refs = [ref for ref in refs if ref.startswith("refs/recovered/")]
        if recovered_refs:
            scope = "recovered-reference"
        elif default_history:
            scope = "default-branch-history"
        elif any(ref.startswith("refs/pull/") for ref in refs):
            scope = "pull-request-reference"
        elif refs:
            scope = "other-branch-or-tag"
        else:
            scope = "unclassified-reachable-history"

        lowered = secret.lower()
        obvious_placeholder = (
            any(term in lowered for term in PLACEHOLDER_TERMS)
            or bool(re.fullmatch(r"(?:x+|0+|1+|a+|f+)", lowered))
        )
        findings.append(
            {
                "repository": args.repository,
                "default_branch": default_branch or None,
                "rule_id": rule,
                "description": row.get("Description"),
                "service": service(rule),
                "file": path,
                "start_line": row.get("StartLine"),
                "end_line": row.get("EndLine"),
                "commit": commit or None,
                "commit_date": row.get("Date"),
                "author": row.get("Author"),
                "email": row.get("Email"),
                "entropy": row.get("Entropy"),
                "value_fingerprint_sha256_16": hashlib.sha256(secret.encode()).hexdigest()[:16] if secret else None,
                "value_length": len(secret),
                "value_shape": value_shape(secret),
                "obvious_placeholder": obvious_placeholder,
                "file_context": file_context(path),
                "scope": scope,
                "on_default_branch_history": default_history,
                "containing_refs": refs,
                "recovered_refs": recovered_refs,
                "harvest_sources": candidate_sources.get(commit, []),
                "refs_lookup_skipped": rule not in HIGH_VALUE_RULES,
            }
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                "repository": args.repository,
                "default_branch": default_branch or None,
                "finding_count": len(findings),
                "findings": findings,
                "redaction": "Raw values were replaced by short SHA-256 fingerprints, lengths, and shapes. Secret, Match, and line-content fields are absent.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
