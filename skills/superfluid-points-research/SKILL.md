---
name: superfluid-points-research
description: Research and implement Superfluid points / SPR campaign discovery, claim-app program lookup, SUP onchain emission programs, CMS points-event enumeration, and claim voucher tooling. Use when Codex needs to find hidden Superfluid points programs, inspect claim.superfluid.org APIs/routes/server actions, query SUP or protocol subgraphs, cross-check cms.superfluid.pro points endpoints, export point event names, or update claim voucher tools.
---

# Superfluid Points Research

## Core workflow

1. Treat the SUP Goldsky subgraph as the authoritative enumerator for onchain emission `Program` existence and lifecycle fields.
2. Use direct Base RPC to verify `FluidEPProgramManager.getProgramPool(programId)` and, for current state, pool `getTotalFlowRate`.
3. Use the Base protocol subgraph for bulk GDA pool enrichment: indexed pool state, members, units, and distributions.
4. Treat `https://claim.superfluid.org/api/programs` as attribution only: app IDs, seasons, display names, claim-app `onchainInfo`, and other human-readable metadata. Do not use it as the primary source for onchain program existence.
5. Treat `cms.superfluid.pro` `/points/*` routes as the source for offchain point-event data and CMS campaign metadata where that metadata exists.
6. Cross-check SUP subgraph, RPC, protocol subgraph, claim API, CMS, and `/points/balance-batch` before concluding a campaign/program is missing.
7. Prefer batched endpoints and caching; do not brute-force `GET /points/campaign` one ID at a time unless no batch route is available.

## Source hierarchy

When researching Superfluid points / SPR campaigns, prefer sources in this order:

1. Live CMS, claim-app, SUP subgraph, protocol subgraph, and RPC responses.
2. Committed research notes and captured evidence under `research/`.
3. The endpoint reference in this skill and the locally authored tools under `tools/`.
4. Narrow external source fragments documented in `PROVENANCE.md`.
5. Reverse-engineered public app bundles and app-local routes.
6. Explicitly labeled inference.

When answering campaign ID, funding-start, leaderboard, or account-placement questions, cite or name the source category used. If multiple categories disagree, call out the conflict and prefer the highest-ranking applicable source.

## Known useful endpoints

- `GET https://claim.superfluid.org/api/programs` returns claim-app program metadata as `{ json: ProgramApp[] }`. Use it before the legacy Next.js server action. Important fields: `appId`, `name`, `season`, `category`, `program.id`, `program.onchainInfo.poolAddress`, `fundingFlowRate`, `fundingStartDate`, `fundingEndDate`, `totalAllocated`, `totalClaimed`, `isFundingStarted`, `isFundingFinished`, and `totalMembers`.
- `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>` returns offchain CMS campaign metadata if the campaign exists.
- `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>` returns point events plus pagination.
- `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>` returns SuperJSON as `{ json: { accountAddress, lockerAddress, programPointStates, canClaim } }`. Observed state rows use `{ programId, offchainPoints, onchainPoints, isOnchainOutdated }`.
  - Treat `offchainPoints` as the CMS signed/capped target units for that account/program. In live probes, it matched CMS `/points/balance-batch` `cappedPoints` / signed-batch `points`, not uncapped raw `points` from `/points/balance-batch`.
  - Treat `onchainPoints` as current onchain pool member units for the account locker/member in that program. `isOnchainOutdated` means the signed CMS target differs from current onchain units and the user can claim/update.
  - The claim frontend bundle only calls this route; the route implementation is not in the client bundle. Reconstruct it by joining CMS capped balances with onchain pool-member units from the locker/program pools.
- `POST https://cms.superfluid.pro/points/balance-batch` accepts up to 50 IDs:

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611, 9999]
}
```

The response includes `warnings: [{ campaignId, message: "Campaign not found" }]` for IDs missing from the offchain CMS. Use this to scan ranges such as `1..9999` in chunks of 50.

## SUP and protocol subgraphs

SUP onchain emission programs are indexed in the Goldsky-hosted SUP subgraph:

```text
https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn
```

Query `programs` to enumerate onchain claim programs and lifecycle fields:

```graphql
query SupPrograms($lastId: String!) {
  programs(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: $lastId }) {
    id
    distributionPool
    fundingAmount
    subsidyAmount
    earlyEndDate
    endDate
    stoppedDate
    cancellationDate
    returnedDeposit
    blockTimestamp
    transactionHash
  }
}
```

Base protocol pool state is available from:

```text
https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1
```

After SUP `Program` enumeration, verify pools by direct RPC against `FluidEPProgramManager.getProgramPool(programId)`. Use `pools(where: { id_in: [...] })` for indexed GDA pool fields such as `flowRate`, `totalMembers`, `totalUnits`, `totalAmountDistributedUntilUpdatedAt`, and `updatedAtTimestamp`. Do **not** interpret `Pool.updatedAtTimestamp` as "last SUP flowed"; member/unit updates also change it. For current real-time flow/balance state, prefer Base RPC calls to `FluidEPProgramManager.getProgramPool(programId)` and pool methods such as `getTotalFlowRate`.

Known Base program manager:

```text
0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a
```

## claim.superfluid.org program list

Prefer `GET /api/programs`. Use the legacy Next.js server action only as a fallback or cross-check. The claim app uses a Next.js server action named `getProgramApps`. The action ID observed on July 2, 2026 was:

```text
0050c3f0d604f9162ceb3faa2d83005031b4be6b5f
```

Call it like this:

```bash
curl -sS -L 'https://claim.superfluid.org/' \
  -H 'next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f' \
  -H 'content-type: text/plain;charset=UTF-8' \
  -H 'accept: text/x-component' \
  --data-raw '[]'
```

The response is React Flight text. The line beginning with `1:` contains a JSON array of program apps. Parse that line by stripping the `1:` prefix and `JSON.parse` it. Extract IDs from `app.program?.id`.

If the action ID stops working, fetch `https://claim.superfluid.org`, download its `/_next/static/...js` chunks, and search for `getProgramApps`, `createServerReference`, `programApps`, `/api/points/states`, or `/api/points/claim` to find the new server action ID and related routes.

## Get position of an account on a leaderboard

Use this procedure for account position, place, rank, or leaderboard lookups. Campaign lookups require `campaignId`.

1. Validate and normalize the account address.
2. For campaign placement, confirm the campaign exists with `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`.
3. For campaign placement, use `GET https://cms.superfluid.pro/points/accounts?campaignId=<id>&account=<account>`. The returned `accounts[]` list is the sorted campaign leaderboard for the request.
4. For overall placement, use `GET https://claim.superfluid.org/api/leaderboard`.
5. Use server-provided `rank`, `place`, or list order. Do not recompute ranks from raw point events unless CMS code or docs define the ranking algorithm, tie handling, capped points behavior, and excluded events.

Campaign example:

```text
https://cms.superfluid.pro/points/accounts?campaignId=699&account=0xdBb811EC62338db94858Ec21ef1d56B658111922
```

Known campaign fields: `accounts[]`, `accounts[].account`, `accounts[].totalPoints`, `accounts[].eventCount`, and `accounts[].lastEventAt`. Also document any returned `rank`, `place`, `points`, `cappedPoints`, or equivalent fields when present.

## Important interpretation

- Claim API/route program IDs are onchain claim programs; not all of them resolve in `/points/campaign`.
- SUP subgraph `Program` IDs are onchain emission programs; some have no claim-app attribution and some have no CMS point events.
- `/points/balance-batch` identifies offchain CMS campaign IDs, including hidden IDs above 1000.
- Report these sets separately: claim API IDs, legacy claim route IDs, SUP subgraph IDs, balance-batch IDs, resolved CMS IDs, missing-from-CMS IDs, onchain-only IDs, and CMS-only IDs.
- For point-event names, only resolved CMS campaigns can be enumerated with `/points/events`.

## Claim voucher tooling

For `tools/claim-voucher/injector.js` and its README:

1. Keep voucher signing through `POST https://cms.superfluid.pro/points/signed-balance-batch`. The CMS batch endpoint signs selected campaign subsets and supports one or many campaigns.
   - `signed-balance-batch.points` are the signed target units. When `uncappedPoints` is present, keep it diagnostic-only; do not submit it as `totalProgramUnits`.
2. Use `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>` for account point-state rows.
3. Use `GET https://claim.superfluid.org/api/programs` for program names, seasons, app IDs, pool addresses, and claim-app `onchainInfo` in the UI. Do not use the SUP/protocol subgraphs for the actual signed voucher payload.
4. Use `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>` only as optional reference/debug data.
5. Preserve cache correctness: voucher reuse requires the same selected program IDs, non-stale nonce/timestamp, and exact current offchain target totals.

## Performance defaults

- Use HTTP/2 curl requests when Node fetch cannot reach the network in the agent environment.
- Cache successful HTTP responses in a local JSON cache.
- Scan `/points/balance-batch` with chunks of 50 and bounded concurrency.
- For finished pre-Season-6 campaigns, sampling first and final `limit=100` pages may be enough for exploratory event-name reports; for Season 6+ and known in-progress older campaigns, fetch all pages.


## Repository map

Open `RESEARCH-MAP.md` before substantial work. It maps questions to the smallest useful set of research notes, evidence, and executable tools.

## Official Superfluid skill boundary

The official `superfluid` skill is expected to be installed beside this skill. Use it for protocol-wide contract ABIs, selectors, deployed-address catalogs, architecture, generic SDK usage, standard subgraph guidance, and reusable protocol helper scripts.

Do not copy those materials into this repository. Add a narrow external fragment only when an investigation must modify it or pin an exact source version, and record its repository, path, commit, reason, and local changes in `PROVENANCE.md`.
