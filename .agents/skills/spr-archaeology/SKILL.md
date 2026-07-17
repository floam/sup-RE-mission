---
name: spr-archaeology
description: Research historical or hidden Superfluid Points Rewards traces, old campaigns, pre-S5 programs, missing CMS IDs, onchain-only SUP programs, claim/campaign app bundles, GitHub repos, subgraphs, and undocumented APIs. Use for SPR archaeology, old campaign IDs, reverse engineering, public bundle audits, and cross-source discrepancies.
---

# SPR archaeology

Use this skill when the task is explicitly historical, forensic, or exploratory.

## What to look for

- Pre-S5 campaigns and old SPR/SUP programs.
- Claim-app program IDs that return `Campaign not found` from CMS.
- CMS-only campaign IDs with no SUP subgraph program.
- SUP subgraph programs with no claim-app attribution.
- Routes/endpoints observed in deployed bundles but not implemented in this repo.
- New APIs or subgraph query documents in `superfluid-org` repositories.

## Source order

1. Local repo code, schemas, scripts, docs, and audits.
2. `.agents/skills/superfluid-points-research/references/endpoints.md`.
3. Live public endpoints when needed.
4. GitHub repos under `superfluid-org`, especially `sup-token`, `skills`, `protocol-monorepo`, `superfluid-explorer`, `superfluid-dashboard`, and `sup-metrics-api`.
5. Public bundles from `claim.superfluid.org` and `campaigns.superfluid.org`.

## Discovery techniques

- Use `/points/balance-batch` in chunks of 50 to discover CMS campaign IDs. Do not brute-force individual `/points/campaign` calls unless no batch path exists.
- Use the SUP Goldsky subgraph to enumerate onchain emission `Program` entities.
- Use claim `/api/programs` for human-readable season/app attribution.
- Use protocol subgraphs/RPC for pool state.
- Download public Next.js bundles only to a temp directory such as `/tmp/spr-audit`; do not commit downloaded bundles.

## Important distinctions

Report these ID sets separately:

- claim-app program IDs
- legacy claim-route program IDs
- SUP subgraph onchain program IDs
- CMS `/points/balance-batch` IDs
- resolved CMS campaign IDs
- missing-from-CMS IDs
- onchain-only IDs
- CMS-only IDs

Do not infer that “missing from CMS” means “ended,” and do not infer that `Pool.updatedAtTimestamp` means “last SUP flowed.”

## Output style

Archaeology answers should include:

- source category for each finding
- exact endpoint/repo/file where applicable
- confidence level or explicit inference marker
- reproduction command(s)
- unresolved leads and next probes

Reference shared endpoint details in `../superfluid-points-research/references/endpoints.md` when exact request/response shapes are needed.
