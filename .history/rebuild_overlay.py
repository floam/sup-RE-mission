#!/usr/bin/env python3
import datetime
import os
import pathlib
import shutil
import subprocess

SRC = os.environ.get("GITHUB_WORKSPACE", os.getcwd()) + "/.git"
DST = "/tmp/superfluid-overlay.git"
BASE = "0abcb4534dfe92c77011effca8a3709ae5c06280"
OLD_MAIN = "23dbcf601046c143399e5cb85aca94da7422ef7b"
FIX_SOURCE = "dfc6159ea8584026ed713217da91199dc4e283cb"
INDEX = "/tmp/superfluid-overlay.index"


def output(args, *, gitdir=SRC, input_data=None, env=None, text=True):
    return subprocess.check_output(
        ["git", f"--git-dir={gitdir}", *args],
        input=input_data,
        env=env,
        text=text,
    )


def allowed(path):
    if path.startswith(".agents/skills/superfluid/"):
        return False
    if path.startswith(".agents/skills/spr-"):
        return False
    return path != "pnpm-lock.yaml"


def entry(commit, path):
    if not commit:
        return None
    value = output(["ls-tree", commit, "--", path]).strip()
    if not value:
        return None
    head, _ = value.split("\t", 1)
    mode, object_type, sha = head.split()
    return (mode, sha) if object_type == "blob" else None


def hash_blob(data):
    return output(
        ["hash-object", "-w", "--stdin"],
        gitdir=DST,
        input_data=data,
        text=False,
    ).decode().strip()


def write_tree(state):
    try:
        os.unlink(INDEX)
    except FileNotFoundError:
        pass
    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = INDEX
    subprocess.run(
        ["git", f"--git-dir={DST}", "read-tree", "--empty"],
        env=env,
        check=True,
    )
    rows = "".join(
        f"{mode} {sha}\t{path}\n"
        for path, (mode, sha) in sorted(state.items())
    )
    subprocess.run(
        ["git", f"--git-dir={DST}", "update-index", "--index-info"],
        env=env,
        input=rows,
        text=True,
        check=True,
    )
    return subprocess.check_output(
        ["git", f"--git-dir={DST}", "write-tree"], env=env, text=True
    ).strip()


def create_commit(tree, parents, message, author, committer):
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": author[0],
            "GIT_AUTHOR_EMAIL": author[1],
            "GIT_AUTHOR_DATE": author[2],
            "GIT_COMMITTER_NAME": committer[0],
            "GIT_COMMITTER_EMAIL": committer[1],
            "GIT_COMMITTER_DATE": committer[2],
        }
    )
    command = ["git", f"--git-dir={DST}", "commit-tree", tree]
    for parent in parents:
        command.extend(["-p", parent])
    return subprocess.check_output(
        command, input=message, env=env, text=True
    ).strip()


def metadata(commit):
    fmt = "%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B"
    fields = output(["show", "-s", f"--format={fmt}", commit]).split("\x00", 6)
    author = (fields[0], fields[1], fields[2])
    committer = (fields[3], fields[4], fields[5])
    return author, committer, fields[6]


for required in (BASE, OLD_MAIN, FIX_SOURCE):
    subprocess.run(
        ["git", f"--git-dir={SRC}", "cat-file", "-e", f"{required}^{{commit}}"],
        check=True,
    )

commits = output(
    ["rev-list", "--reverse", "--topo-order", OLD_MAIN, f"^{BASE}"]
).split()
paths = set()
for commit in commits:
    parents = output(["show", "-s", "--format=%P", commit]).strip().split()
    first_parent = parents[0] if parents else None
    args = ["diff-tree", "--no-commit-id", "--name-only", "-r", "-M"]
    args.extend([first_parent, commit] if first_parent else ["--root", commit])
    paths.update(path for path in output(args).splitlines() if allowed(path))
paths.add("cms/src/scripts/export-point-event-names.ts")

shutil.rmtree(DST, ignore_errors=True)
subprocess.run(["git", "init", "--bare", DST], check=True)
alternates = pathlib.Path(DST) / "objects/info/alternates"
alternates.parent.mkdir(parents=True, exist_ok=True)
alternates.write_text(str(pathlib.Path(SRC) / "objects") + "\n")

states = {}
rewritten = {}
for commit in commits:
    parents = output(["show", "-s", "--format=%P", commit]).strip().split()
    state = {}
    for path in paths:
        baseline = entry(BASE, path)
        current = entry(commit, path)
        if current is not None and current != baseline:
            state[path] = current
    tree = write_tree(state)
    mapped_parents = [rewritten[parent] for parent in parents if parent in rewritten]
    author, committer, message = metadata(commit)
    rewritten[commit] = create_commit(
        tree, mapped_parents, message, author, committer
    )
    states[commit] = state

parent = rewritten[OLD_MAIN]
state = dict(states[OLD_MAIN])
state["cms/src/scripts/export-point-event-names.ts"] = entry(
    FIX_SOURCE, "cms/src/scripts/export-point-event-names.ts"
)
fix_tree = write_tree(state)
fix = create_commit(
    fix_tree,
    [parent],
    "fix(cms): correct campaign discovery source checks\n",
    ("Aaron Gyes", "me@aaron.gy", "2026-07-18T02:07:57-07:00"),
    ("Aaron Gyes", "me@aaron.gy", "2026-07-18T02:07:57-07:00"),
)

files = {
    "AGENTS.md": """# Repository guidance

This repository is a sparse historical overlay containing the Superfluid claim-voucher Shortcuts injector, the `superfluid-points-research` skill, and focused investigation artifacts.

For points, campaign, claim, event-name, or nonce work:

1. Read `.agents/skills/superfluid-points-research/SKILL.md`.
2. Read `POINTS-RESEARCH-CONTEXT.md` and load only the files mapped to the task.
3. Treat retained `cms/`, `sdk/`, and `website/` paths as individual investigation deltas, not complete upstream applications.
4. Assume the general Superfluid skill is installed separately for protocol-wide ABIs, subgraphs, SDK usage, and architecture.

Do not reintroduce the upstream monorepo. Add an upstream file only when an investigation intentionally modifies or preserves that specific file.
""",
    "POINTS-RESEARCH-CONTEXT.md": """# Superfluid points investigation map

Use this after the `superfluid-points-research` skill activates. Load the smallest relevant group. Files outside `SKILL.md` are not guaranteed to enter agent context merely because they exist.

## Shortcuts injector

- `docs/tools/claim-voucher-shortcuts.js`: complete browser/Apple Shortcuts injector.
- `docs/tools/claim-voucher-shortcuts.md`: installation, behavior, and operational notes.

## Campaign and endpoint discovery

- `.agents/skills/superfluid-points-research/references/endpoints.md`: endpoint catalog and interpretation rules.
- `docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`: reverse-engineering and audit findings.
- `cms/src/scripts/export-point-event-names.ts`: live campaign/program discovery and event enumeration.

## Point-event evidence

- `cms/src/scripts/export-point-event-names.ts`: discovery, caching, coalescing, and HTML generation.
- `website/public/point-event-names.html`: generated observed-event catalog.

## Claim vouchers

- `docs/tools/claim-voucher-shortcuts.js`
- `docs/tools/claim-voucher-shortcuts.md`
- `.agents/skills/superfluid-points-research/references/endpoints.md`

## Nonce and claim-history research

- `docs/security/fluid-ep-nonce-staleness-assessment.md`: conclusions, threat model, and evidence limits.
- `sdk/package/scripts/investigate-sup-nonces.js`: transaction/log scanner and calldata decoder.
- `sdk/package/tests/investigate-sup-nonces.live.test.ts`: live smoke-test example.
- `.github/workflows/investigate-sup-nonces-bundle.yml`: portable JavaScriptCore/a-Shell bundle workflow.

## Sparse-overlay rule

The upstream repository is deliberately absent from history. A file inherited from upstream enters this repository only in the first commit that changes it, containing the complete post-change file. If it returns to the upstream baseline, it disappears from the overlay again.

Use the separately installed general `superfluid` skill for contract ABIs, selectors, generic protocol subgraphs, SDK guidance, and architecture.
""",
    "README.md": """# Superfluid points investigations

A sparse historical overlay for the claim-voucher Shortcuts injector and the `superfluid-points-research` skill.

This is not a forked working copy of `superfluid-org/superfluid.pro`. Untouched upstream files are absent. Files inherited from upstream first appear in the commit where this repository changed them, as though the upstream tree had existed locally but remained untracked.

## Main artifacts

- `docs/tools/claim-voucher-shortcuts.js`
- `.agents/skills/superfluid-points-research/SKILL.md`
- `POINTS-RESEARCH-CONTEXT.md`
- `cms/src/scripts/export-point-event-names.ts`
- `sdk/package/scripts/investigate-sup-nonces.js`

## Commands

```sh
npm install
npm run export:point-events
npm run investigate:nonces -- --user 0x... --program-ids 607
npm run test:nonces
npm run bundle:nonces
```
""",
    "package.json": """{
  "name": "superfluid-points-investigations",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Claim-voucher injector and focused Superfluid points investigation tools",
  "scripts": {
    "export:point-events": "tsx cms/src/scripts/export-point-event-names.ts",
    "investigate:nonces": "node sdk/package/scripts/investigate-sup-nonces.js",
    "test:nonces": "vitest run sdk/package/tests/investigate-sup-nonces.live.test.ts",
    "bundle:nonces": "esbuild sdk/package/scripts/investigate-sup-nonces.js --bundle --platform=browser --target=es2020 --outfile=investigate-sup-nonces.bundle.js"
  },
  "dependencies": {
    "viem": "^2.52.2"
  },
  "devDependencies": {
    "esbuild": "^0.28.0",
    "tsx": "^4.22.4",
    "undici": "^7.24.4",
    "vitest": "^4.1.8"
  },
  "engines": {
    "node": ">=22"
  }
}
""",
    ".gitignore": """node_modules/
.cache/
*.log
investigate-sup-nonces.bundle.js
.DS_Store
""",
    ".github/workflows/investigate-sup-nonces-bundle.yml": """name: Build SUP nonce investigation bundle

on:
  workflow_dispatch:
  push:
    tags:
      - "investigate-sup-nonces-*"

permissions:
  contents: write

jobs:
  bundle:
    name: Bundle for JavaScriptCore / a-Shell
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Bundle investigate-sup-nonces for JavaScriptCore
        run: npm run bundle:nonces

      - name: Upload bundle artifact
        uses: actions/upload-artifact@v4
        with:
          name: investigate-sup-nonces-javascriptcore
          path: investigate-sup-nonces.bundle.js
          if-no-files-found: error

      - name: Attach bundle to tag release
        if: startsWith(github.ref, 'refs/tags/')
        uses: softprops/action-gh-release@v2
        with:
          files: investigate-sup-nonces.bundle.js
""",
}
for path, content in files.items():
    state[path] = ("100644", hash_blob(content.encode()))
state.pop("cms/package.json", None)
state.pop("sdk/package/package.json", None)

skill_path = ".agents/skills/superfluid-points-research/SKILL.md"
skill = subprocess.check_output(
    ["git", f"--git-dir={DST}", "show", f"{fix}:{skill_path}"]
).decode()
if "## Context loading" not in skill:
    skill += """
## Context loading

When this skill activates, open `POINTS-RESEARCH-CONTEXT.md` at the repository root before substantial research or implementation. It maps task categories to audits, generated point-event evidence, executable tools, and exact retained source files. Files outside `SKILL.md` are not guaranteed to enter context merely because they exist, so follow that map explicitly.
"""
state[skill_path] = ("100644", hash_blob(skill.encode()))

final_tree = write_tree(state)
final_date = "2026-07-18T02:53:09-07:00"
final = create_commit(
    final_tree,
    [fix],
    "refactor: make fork a sparse investigation overlay\n",
    ("Aaron Gyes", "me@aaron.gy", final_date),
    ("Aaron Gyes", "me@aaron.gy", final_date),
)
subprocess.run(
    ["git", f"--git-dir={DST}", "update-ref", "refs/heads/main", final],
    check=True,
)
subprocess.run(
    ["git", f"--git-dir={DST}", "symbolic-ref", "HEAD", "refs/heads/main"],
    check=True,
)
print(final)
