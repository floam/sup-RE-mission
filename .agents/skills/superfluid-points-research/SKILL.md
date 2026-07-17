---
name: superfluid-points-research
description: Router and shared reference for Superfluid Points Rewards (SPR/SUP) research. Prefer the targeted SPR skills for campaign enumeration, point events, archaeology, claim points, or single-campaign queries; use this skill when a task spans multiple points surfaces or needs shared endpoint/source hierarchy.
---

# Superfluid Points Research router

This skill now acts as a shared routing layer. For focused work, use the narrower skills first:

| Task | Preferred skill |
| --- | --- |
| Enumerate current/relevant campaigns | `spr-enumerate-campaigns` |
| Fetch/group point events | `spr-point-events` |
| Historical/hidden campaign archaeology | `spr-archaeology` |
| Claim points / vouchers / claim states | `spr-claim-points` |
| Query one campaign/program | `spr-query-campaign` |

Use this skill directly only when a request combines multiple categories or when you need the shared endpoint catalogue in `references/endpoints.md`.

## Core workflow

1. Treat `cms.superfluid.pro` as the source for offchain point-event data and CMS campaign metadata.
2. Treat `https://claim.superfluid.org/api/programs` as the preferred claim-app catalog for app IDs, seasons, display names, program IDs, pool addresses, allocations, and claim-app `onchainInfo`.
3. Treat the SUP Goldsky subgraph as the source for onchain emission `Program` existence and lifecycle fields.
4. Treat the Base protocol subgraph or RPC as the source for GDA pool state. Prefer RPC for current real-time balances/flows; use subgraphs for enumeration and indexed event/lifecycle data.
5. Cross-check claim API, SUP subgraph, CMS, and `/points/balance-batch` before concluding a campaign/program is missing.
6. Prefer batched endpoints and caching; do not brute-force `GET /points/campaign` one ID at a time unless no batch route is available.

## Source hierarchy

When researching Superfluid points / SPR campaigns, prefer sources in this order:

1. CMS route handlers/source code in this fork.
2. CMS schemas, types, fixtures, tests, and OpenAPI artifacts.
3. Committed docs/audits, especially `docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`.
4. Live CMS endpoint responses when the task allows network access.
5. Live claim API (`/api/programs`) and SUP/protocol subgraph responses.
6. Reverse-engineered `claim.superfluid.org` and `campaigns.superfluid.org` bundle notes.
7. Public app-local routes.
8. Explicitly-labeled inference.

When answering campaign ID, funding-start, leaderboard, or account-placement questions, cite or name the source category used. If multiple categories disagree, call out the conflict and prefer the highest-ranking applicable source.

## Known useful endpoints

- `GET https://claim.superfluid.org/api/programs` returns claim-app program metadata as `{ json: ProgramApp[] }`. Use it before the legacy Next.js server action. Important fields: `appId`, `name`, `season`, `category`, `program.id`, `program.onchainInfo.poolAddress`, `fundingFlowRate`, `fundingStartDate`, `fundingEndDate`, `totalAllocated`, `totalClaimed`, `isFundingStarted`, `isFundingFinished`, and `totalMembers`.
- `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>` returns offchain CMS campaign metadata if the campaign exists.
- `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>` returns point events plus pagination.
- `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>` returns SuperJSON as `{ json: { accountAddress, lockerAddress, programPointStates, canClaim } }`. Observed state rows use `{ programId, offchainPoints, onchainPoints, isOnchainOutdated }`.
- `POST https://cms.superfluid.pro/points/balance-batch` accepts up to 50 IDs and returns warnings for missing campaigns. Use it for CMS existence scans.
- `POST https://cms.superfluid.pro/points/signed-balance-batch` signs selected campaign subsets for claim tooling.

## SUP and protocol subgraphs

SUP onchain emission programs are indexed in the Goldsky-hosted SUP subgraph:

```text
https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn
```

Base protocol pool state is available from:

```text
https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1
```

Known Base program manager:

```text
0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a
```

Do **not** interpret `Pool.updatedAtTimestamp` as "last SUP flowed"; member/unit updates also change it. For current real-time flow/balance state, prefer Base RPC calls to `FluidEPProgramManager.getProgramPool(programId)` and pool methods such as `getTotalFlowRate`.

## Important interpretation

- Claim API/route program IDs are onchain claim programs; not all of them resolve in `/points/campaign`.
- SUP subgraph `Program` IDs are onchain emission programs; some have no claim-app attribution and some have no CMS point events.
- `/points/balance-batch` identifies offchain CMS campaign IDs, including hidden IDs above 1000.
- Report these sets separately: claim API IDs, legacy claim route IDs, SUP subgraph IDs, balance-batch IDs, resolved CMS IDs, missing-from-CMS IDs, onchain-only IDs, and CMS-only IDs.
- For point-event names, only resolved CMS campaigns can be enumerated with `/points/events`.

## Performance defaults

- Use HTTP/2 curl requests when Node fetch cannot reach the network in the agent environment.
- Cache successful HTTP responses in a local JSON cache.
- Scan `/points/balance-batch` with chunks of 50 and bounded concurrency.
- For finished pre-Season-6 campaigns, sampling first and final `limit=100` pages may be enough for exploratory event-name reports; for Season 6+ and known in-progress older campaigns, fetch all pages.
