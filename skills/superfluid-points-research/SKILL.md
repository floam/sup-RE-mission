---
name: superfluid-points-research
description: Research and implement Superfluid points / SPR campaign discovery, claim-app program lookup, SUP onchain emission programs, CMS points-event enumeration, pending-claim explanations, flow projections, and claim voucher tooling. Use when Codex needs to find hidden Superfluid points programs, inspect claim.superfluid.org APIs/routes/server actions, query SUP or protocol subgraphs, cross-check cms.superfluid.pro points endpoints, explain what a pending claim contains, export point event names, or update claim tooling.
---

# Superfluid Points Research

## Start here

1. Open `RESEARCH-MAP.md` and load the smallest relevant evidence set.
2. Open `references/endpoints.md` for public response shapes and error behavior.
3. Open `references/runtime-endpoints.md` for the runnable reconstruction's exact endpoint inventory, SDK/Wagmi procedures, CMS OpenAPI client boundary, claim-event rules, and pending-claim workflow.
4. Check `PROVENANCE.md` before changing ABI fragments, external deployment metadata, or recovered-source claims.

## Core source hierarchy

Use live sources in this order, while distinguishing what each can prove:

1. SUP Goldsky subgraph for onchain emission `Program`, `Locker`, `FluidStreamClaimEvent`, and `ClaimEventUnit` entities.
2. Direct Base RPC for contract truth: program pool, locker, member units, member flow, pool total units, current pool flow, and event-log verification.
3. Base protocol subgraph for indexed bulk GDA enrichment: members, units, distributions, historical entities, and pool metadata.
4. `claim.superfluid.org/api/programs` for app attribution: app IDs, seasons, display names, claim-app `onchainInfo`, and other human-readable metadata.
5. `cms.superfluid.pro/points/*` for offchain campaigns, capped/signed targets, accounts, and point events.
6. `balances.superfluid.dev` only as an optional token-ledger diagnostic. Do not depend on it to find SUP locker claims or GDA member-unit history; known locker/SUP queries can be empty even when claims exist.
7. Committed evidence under `research/`, then reverse-engineered bundles, then clearly labeled inference.

Do not let one layer answer a question it cannot prove:

- Claim-app metadata does not establish onchain program existence.
- CMS absence does not disprove a SUP subgraph `Program`.
- A balance-ledger result does not establish claim history, and an empty result does not establish that no claim occurred.
- A pool `updatedAtTimestamp` does not mean SUP last flowed at that time.
- CMS event `createdAt` is the compatibility name for `eventTime`, not the database insertion timestamp. A time-bounded event result can omit a later-inserted backfill whose event time predates the boundary.

## Core campaign workflow

1. Enumerate `Program` entities from the SUP subgraph.
2. Verify each candidate pool through direct RPC `FluidEPProgramManager.getProgramPool(programId)`.
3. Read current pool flow through RPC `getTotalFlowRate`.
4. Enrich in bulk through the Base protocol subgraph.
5. Join claim-app attribution from `GET https://claim.superfluid.org/api/programs`.
6. Resolve CMS existence and capped account targets in chunks of 50.
7. Fetch campaign metadata or events only after a CMS campaign ID is known to exist.
8. Report source sets separately: SUP programs, claim-app programs, resolved CMS campaigns, missing-from-CMS programs, CMS-only IDs, and attribution-only records.

Prefer batched endpoints and bounded concurrency. Do not brute-force one campaign ID at a time when the batch balance operation can establish CMS existence.

## Known primary endpoints

- `GET https://claim.superfluid.org/api/programs`
- `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>`
- `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>`
- `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`
- `GET https://cms.superfluid.pro/points/events?campaignId=<id>&account=<address>&startTime=<time>&endTime=<time>&limit=100&page=<page>`
- `POST https://cms.superfluid.pro/points/balance-batch`
- `POST https://cms.superfluid.pro/points/signed-balance-batch`
- SUP subgraph: `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn`
- Base protocol subgraph: `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1`
- Optional ledger diagnostics: `GET https://balances.superfluid.dev/v1/accounts/{account}/tokens/{token}/entries?chain=8453&direction=desc&limit=100&offset=0`

The exhaustive operational list, including claim-app-local routes, metrics, referral, Whois, LiFi, Uniswap, testnet, campaigns-app, and reconstruction-local endpoints, is in `references/runtime-endpoints.md`.

## CMS OpenAPI client boundary

The runnable reconstruction must not construct CMS URLs in claim components, claim-state helpers, or API routes.

- `research/claim-app-sources/reconstructed/lib/cms-client.ts` is the sole CMS transport boundary.
- Use `cmsClient.GET("/points/balance", …)`, `getBalances`, `getSignedBalances`, `getEventsPage`, and `getEventsSince`.
- Add a typed operation there when a new CMS capability is required.
- Keep raw CMS URLs in endpoint documentation and external-contract tests only.
- `@sfpro/sdk` 0.2.3 does not contain a CMS HTTP client; it supplies contract ABIs, Wagmi hooks, and Wagmi actions. Do not falsely attribute the repository-authored generated `openapi-fetch` client to that package.
- The current CMS shapes are checked against `superfluid-org/superfluid.pro` commit `a79f0cd7969fbd96f97c7451079a538d8fc7202c`.

## Build claim state with @sfpro/sdk, Wagmi, and generated CMS client

1. Import `lockerFactoryAddress`, `lockerFactoryAbi`, and `lockerAbi` from `@sfpro/sdk/abi/sup`.
2. Use Wagmi `readContract` or hooks for reads; use `useWriteContract` for wallet submission and `waitForTransactionReceipt` for confirmation.
3. Resolve the user's locker with `getUserLocker(account)`.
4. Fetch programs from the SUP subgraph and retain only active programs for the claim comparison.
5. Fetch capped target units with `cmsClient.POST("/points/balance-batch", …)` in chunks of 50.
6. Before mapping values, require the response account to match, campaign IDs to preserve request order, and all parallel point arrays to have the expected length.
7. Read current units with `locker.getUnitsPerProgram(programId)`.
8. Read current member flow with `locker.getFlowRatePerProgram(programId)`.
9. Read pool `getTotalUnits()` and `getTotalFlowRate()` through the narrow app-owned GDA read fragment because `@sfpro/sdk` does not export the pool ABI.
10. Mark a row claimable only when the CMS campaign exists and the capped target differs from current onchain units.
11. On explicit submission, call `cmsClient.POST("/points/signed-balance-batch", …)`, repeat the response validation, and submit returned `points`, `campaignIds`, `signatureTimestamp`, and `signature` through SDK `lockerAbi`. Never submit diagnostic `uncappedPoints`.
12. Require the receipt to report `status: success`. When one batch confirms and a later batch fails, refresh state so the successful partial claim is visible.

For Wagmi 3 core `readContract` calls in this repository, include `authorizationList: undefined` when required by the installed type surface. Do not silence ABI/type errors with broad casts when SDK ABI exports provide correct contract typing.

## Show flows, not only units

The user-facing result should lead with current and projected SUP flow. Keep units as the protocol explanation.

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

Convert per-second flow to `SUP/month` using the repository's average month convention, `2,628,000` seconds. Always label projected flow as an estimate because pool funding or another member's units can change before execution.

## Explain only the pending claim

Use this procedure when the question is “what are these about-to-be-claimed points?” or when implementing the pending-event drawer:

1. Resolve account, locker, program, and pool.
2. Query SUP-subgraph `fluidStreamClaimEvents` for the locker, newest first, including `blockNumber`, `blockTimestamp`, `transactionHash`, and derived `units { programId }`.
3. Keep only events whose units include the requested campaign ID.
4. Verify candidates at their exact block through Wagmi `publicClient.getLogs` using SDK-defined `FluidStreamClaimed` and `FluidStreamsClaimed` ABI items. Require the onchain log transaction hash to equal the indexed event transaction hash.
5. Use only a verified locker claim timestamp as `lastClaimAt`. If the subgraph has a candidate that RPC cannot verify, return `indexed-claim-unverified`; if no candidate exists, return `no-claim`.
6. If no verified boundary exists, do not present full campaign history as the pending claim.
7. Call `getCmsEventsSince` with campaign, account, and the verified boundary. It paginates, excludes events exactly equal to the boundary, and fails rather than silently truncating at the configured page cap.
8. Describe the result as events **dated** after the claim. CMS filters `eventTime` and returns it as `createdAt`; it cannot reveal a backfilled event's later insertion time.
9. Group events by semantic family. Strip only a trailing opaque identifier, EVM address, or transaction hash.
10. Render compact rows such as `3 × NFT mint = +30 pts`, with one date or date range beneath.
11. Keep opaque IDs and complete campaign history out of the claim surface. Put them in a separate explorer.
12. Reconcile the displayed CMS event sum with the signed target delta and projected flow while acknowledging caps, corrections, backfills, and campaign-specific processing.

The reconstruction's local route is:

```text
GET /api/pending-claim-events?account=<address>&campaignId=<id>
```

It inspects at most 1,000 indexed locker claim events and verifies at most 25 campaign-matching candidates. Treat `lastClaimAt: null` as a normal first-claim or unverifiable-index state, never as permission to substitute campaign inception.

## Get account position on a leaderboard

1. Normalize the account address.
2. Confirm a campaign with `GET /points/campaign?campaignId=<id>` when campaign-specific.
3. Use `GET /points/accounts?campaignId=<id>&account=<account>` or the paginated campaign accounts route for campaign placement.
4. Use `GET https://claim.superfluid.org/api/leaderboard` and `/api/leaderboard/search?address=<address>` for the overall claim-app leaderboard.
5. Use server-provided rank/place or list order. Do not recompute ranking unless tie, cap, and exclusion rules are proven.

## SUP subgraph queries

Programs:

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

Locker claims:

```graphql
query LockerClaims($locker: Bytes!) {
  fluidStreamClaimEvents(
    first: 1000
    orderBy: blockTimestamp
    orderDirection: desc
    where: { locker: $locker }
  ) {
    blockNumber
    blockTimestamp
    transactionHash
    units(first: 1000) {
      programId
    }
  }
}
```

Known Base program manager:

```text
0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a
```

Use protocol-subgraph `pools(where: { id_in: [...] })` for indexed fields such as `flowRate`, `totalMembers`, `totalUnits`, `totalAmountDistributedUntilUpdatedAt`, and `updatedAtTimestamp`. Use RPC for the current real-time answer.

## Claim-app program list fallback

Prefer `GET /api/programs`. The observed legacy `getProgramApps` server action ID on July 2, 2026 was:

```text
0050c3f0d604f9162ceb3faa2d83005031b4be6b5f
```

Invoke it with:

```bash
curl -sS -L 'https://claim.superfluid.org/' \
  -H 'next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f' \
  -H 'content-type: text/plain;charset=UTF-8' \
  -H 'accept: text/x-component' \
  --data-raw '[]'
```

Parse the React Flight line beginning with `1:`. If the action ID rotates, inspect current public chunks for `getProgramApps`, `createServerReference`, `programApps`, `/api/points/states`, or `/api/points/claim`.

## Claim voucher tooling

For `tools/claim-voucher/injector.js` and its README:

1. Sign with the CMS signed-balance-batch contract.
2. Use returned capped/signed `points` as target units.
3. Use claim-app `/api/points/states` for reference state rows, but independently verify onchain units for high-confidence conclusions.
4. Use `/api/programs` for display metadata.
5. Use `/api/points/claim` only as optional reference/debug data.
6. Reuse a cached voucher only when program IDs, target totals, account, and nonce/timestamp remain exact and current.

## Performance and evidence defaults

- Cache successful public responses locally during broad scans.
- Use chunks of 50 for CMS balance/signature batch operations.
- Use limit 100 and paginate all active-campaign event results.
- Fail explicitly rather than returning a silently truncated event result.
- Bound indexed claim-event retrieval and RPC confirmation attempts; state the coverage limit.
- Prefer HTTP/2 curl when an agent's Node runtime cannot reach the network.
- Name or cite the source category used for campaign IDs, funding starts, account placement, claim boundaries, and flow calculations.
- When live sources disagree, preserve the disagreement and prefer the highest-authority source for that specific fact.

## Documentation synchronization

When changing claim flow, endpoints, ABIs, source hierarchy, CMS OpenAPI client operations, or reconstruction architecture, update in the same branch:

- `skills/superfluid-points-research/SKILL.md`
- `skills/superfluid-points-research/references/endpoints.md` or `references/runtime-endpoints.md`
- `RESEARCH-MAP.md`
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`
- `research/claim-app-sources/reconstructed/README.md`
- `PROVENANCE.md` when an external interface fragment or source claim changes

Do not leave obsolete component names, endpoint claims, response statuses, test counts, or “no local API routes” statements behind.

## Official Superfluid skill boundary

The official `superfluid` skill should be installed beside this one. Use it for protocol-wide architecture, selectors, deployed-address catalogs, generic SDK guidance, standard subgraph guidance, and reusable protocol helpers.

Do not copy whole official-skill materials here. Add only a narrow fragment when this investigation must modify or pin it, and record repository, path, commit/version, local changes, and refresh procedure in `PROVENANCE.md`.
