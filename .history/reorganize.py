#!/usr/bin/env python3
import datetime
import os
import pathlib
import subprocess

REPO = "/tmp/superfluid-overlay.git"
WORKSPACE = pathlib.Path(os.environ.get("GITHUB_WORKSPACE", os.getcwd()))
INDEX = "/tmp/sup-remission-final.index"


def out(*args, input_data=None, text=True, env=None):
    return subprocess.check_output(
        ["git", f"--git-dir={REPO}", *args],
        input=input_data,
        text=text,
        env=env,
    )


def run(*args, input_data=None, text=True, env=None):
    subprocess.run(
        ["git", f"--git-dir={REPO}", *args],
        input=input_data,
        text=text,
        env=env,
        check=True,
    )


def show(path):
    return out("show", f"main:{path}")


def blob(data):
    return out("hash-object", "-w", "--stdin", input_data=data, text=False).decode().strip()


def staged(name):
    return (WORKSPACE / ".history" / "final" / name).read_text()


def write_tree(files):
    try:
        os.unlink(INDEX)
    except FileNotFoundError:
        pass
    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = INDEX
    run("read-tree", "--empty", env=env)
    rows = "".join(f"100644 {blob(content.encode())}\t{path}\n" for path, content in sorted(files.items()))
    run("update-index", "--index-info", input_data=rows, env=env)
    return out("write-tree", env=env).strip()


skill = show(".agents/skills/superfluid-points-research/SKILL.md")
skill = skill.replace(
    "1. CMS route handlers/source code in this fork.\n2. CMS schemas, types, fixtures, tests, and OpenAPI artifacts.\n3. Committed docs/audits, especially `docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`.\n4. Live CMS endpoint responses when the task allows network access.\n5. Live claim API (`/api/programs`) and SUP/protocol subgraph responses.\n6. Reverse-engineered `claim.superfluid.org` and `campaigns.superfluid.org` bundle notes.\n7. Public app-local routes.\n8. Explicitly-labeled inference.",
    "1. Live CMS, claim-app, SUP subgraph, protocol subgraph, and RPC responses.\n2. Committed research notes and captured evidence under `research/`.\n3. The endpoint reference in this skill and the locally authored tools under `tools/`.\n4. Narrow external source fragments documented in `PROVENANCE.md`.\n5. Reverse-engineered public app bundles and app-local routes.\n6. Explicitly labeled inference.",
)
skill = skill.replace(
    "For `docs/tools/claim-voucher-shortcuts.js` and related docs:",
    "For `tools/claim-voucher/injector.js` and its README:",
)
marker = "## Context loading"
if marker in skill:
    skill = skill.split(marker, 1)[0].rstrip() + "\n"
skill += """

## Repository map

Open `RESEARCH-MAP.md` before substantial work. It maps questions to the smallest useful set of research notes, evidence, and executable tools.

## Official Superfluid skill boundary

The official `superfluid` skill is expected to be installed beside this skill. Use it for protocol-wide contract ABIs, selectors, deployed-address catalogs, architecture, generic SDK usage, standard subgraph guidance, and reusable protocol helper scripts.

Do not copy those materials into this repository. Add a narrow external fragment only when an investigation must modify it or pin an exact source version, and record its repository, path, commit, reason, and local changes in `PROVENANCE.md`.
"""

endpoints = show(".agents/skills/superfluid-points-research/references/endpoints.md")
endpoints = endpoints.replace(
    "This reference is for SPR/points campaign discovery, campaign metadata, point-event enumeration, claim-program lookup, and leaderboard-related routes. It separates the CMS-backed routes in this repository from routes observed in the deployed `claim.superfluid.org` and `campaigns.superfluid.org` bundles.",
    "This reference is for SPR/points campaign discovery, campaign metadata, point-event enumeration, claim-program lookup, and leaderboard-related routes. It separates CMS-backed routes from routes observed in the deployed `claim.superfluid.org` and `campaigns.superfluid.org` bundles.",
)
endpoints = endpoints.replace(
    "- **CMS-backed**: Implemented by `cms/src/app/(api)/points/*` in this repository and served by `https://cms.superfluid.pro` as `/points/*`.",
    "- **CMS-backed**: Served by `https://cms.superfluid.pro` as `/points/*`; behavior here is documented from public responses and prior source inspection.",
)
endpoints = endpoints.replace(
    "- **claim-app-local**: Observed in the `claim.superfluid.org` bundle as `/api/*` or as a Next.js server action; implementation was not found in this repository.",
    "- **claim-app-local**: Observed in the `claim.superfluid.org` bundle as `/api/*` or as a Next.js server action; implementation is outside this repository.",
)

exporter = show("cms/src/scripts/export-point-event-names.ts").replace(
    'const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "../website/public/point-event-names.html")',
    'const DEFAULT_OUTPUT_PATH = path.resolve(process.cwd(), "tools/point-events/point-event-names.html")',
)
claim_readme = show("docs/tools/claim-voucher-shortcuts.md").replace(
    "# Superfluid claim voucher Shortcuts injector\n\n`claim-voucher-shortcuts.js`",
    "# Superfluid claim voucher Shortcuts injector\n\n`injector.js`",
)
nonce_script = show("sdk/package/scripts/investigate-sup-nonces.js").replace(
    "Usage: pnpm --dir sdk/package investigate:sup-nonces --user <address> --program-ids <ids> [options]",
    "Usage: npm run investigate:nonces -- --user <address> --program-ids <ids> [options]",
)
nonce_test = show("sdk/package/tests/investigate-sup-nonces.live.test.ts")
nonce_test = nonce_test.replace(
    'import { promisify } from "node:util"',
    'import { fileURLToPath } from "node:url"\nimport { promisify } from "node:util"',
)
nonce_test = nonce_test.replace(
    '"scripts/investigate-sup-nonces.js",',
    'fileURLToPath(new URL("./investigate-sup-nonces.js", import.meta.url)),',
)
nonce_test = nonce_test.replace(
    '{ cwd: new URL("..", import.meta.url), maxBuffer: 1024 * 1024 * 10 },',
    '{ maxBuffer: 1024 * 1024 * 10 },',
)

files = {
    ".agents/skills/superfluid-points-research/SKILL.md": skill,
    ".agents/skills/superfluid-points-research/agents/openai.yaml": show(".agents/skills/superfluid-points-research/agents/openai.yaml"),
    ".agents/skills/superfluid-points-research/references/endpoints.md": endpoints,
    ".github/workflows/build-sup-nonce-bundle.yml": staged("build-sup-nonce-bundle.yml"),
    ".gitignore": staged("gitignore"),
    "AGENTS.md": staged("AGENTS.md"),
    "PROVENANCE.md": staged("PROVENANCE.md"),
    "README.md": staged("README.md"),
    "RESEARCH-MAP.md": staged("RESEARCH-MAP.md"),
    "package.json": staged("package.json"),
    "research/2026-06-30-spr-campaigns-claim-endpoints.md": show("docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md"),
    "research/fluid-ep-nonce-staleness-assessment.md": show("docs/security/fluid-ep-nonce-staleness-assessment.md"),
    "tools/claim-voucher/README.md": claim_readme,
    "tools/claim-voucher/injector.js": show("docs/tools/claim-voucher-shortcuts.js"),
    "tools/point-events/export-point-event-names.ts": exporter,
    "tools/point-events/point-event-names.html": show("website/public/point-event-names.html"),
    "tools/sup-nonces/investigate-sup-nonces.js": nonce_script,
    "tools/sup-nonces/investigate-sup-nonces.live.test.ts": nonce_test,
}

tree = write_tree(files)
parent = out("rev-list", "--all", "--grep=^fix(cms): correct campaign discovery source checks$", "-n", "1").strip()
if not parent:
    raise RuntimeError("corrected campaign-discovery commit not found")
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
env = os.environ.copy()
env.update({
    "GIT_AUTHOR_NAME": "Aaron Gyes",
    "GIT_AUTHOR_EMAIL": "me@aaron.gy",
    "GIT_AUTHOR_DATE": now,
    "GIT_COMMITTER_NAME": "Aaron Gyes",
    "GIT_COMMITTER_EMAIL": "me@aaron.gy",
    "GIT_COMMITTER_DATE": now,
})
final = subprocess.check_output(
    ["git", f"--git-dir={REPO}", "commit-tree", tree, "-p", parent],
    input="refactor: organize SUP Re:Mission workbench\n",
    text=True,
    env=env,
).strip()
run("update-ref", "refs/heads/main", final)
print(final)
