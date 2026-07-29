---
name: superfluid-points-research
description: Research and implement Superfluid points / SPR campaign discovery, claim-app program lookup, SUP onchain emission programs, CMS point events, nonce-bounded pending-claim explanations, flow projections, caps, and claim voucher tooling.
---

# Superfluid Points Research

## Start here

1. Open `RESEARCH-MAP.md` and load the smallest relevant evidence set.
2. Open `references/endpoints.md` for public response shapes and errors.
3. Open `references/runtime-endpoints.md` for runnable routes and SDK/Wagmi procedures.
4. Open `references/pending-event-reconciliation.md` for the authoritative claim
   explanation and cap algorithm.
5. Check `PROVENANCE.md` before changing ABI fragments, deployment metadata, generated
   artifacts, or recovered-source claims.

## Source hierarchy

Use each source only for what it can prove:

1. SUP Goldsky subgraph: program/locker/indexed claim entities.
2. Direct Base RPC: contract state, nonces, units, flows, receipts, and logs.
3. Base protocol subgraph: indexed bulk GDA enrichment.
4. `claim.superfluid.org/api/programs`: human-readable attribution.
5. `cms.superfluid.pro/points/*`: raw/capped/signed balances and point events.
6. `balances.superfluid.dev`: optional token-ledger diagnostics only.
7. Committed evidence, recovered bundles, then explicitly labeled inference.

CMS event `createdAt` is `eventTime`, not insertion time. An empty ledger response does
not prove no claim occurred. A nonce snapshot does not identify a transaction hash or
mined timestamp.

## Campaign workflow

1. Enumerate SUP `Program` entities.
2. Verify pools with direct RPC when high confidence is required.
3. Read current pool flow and enrich through the protocol subgraph when useful.
4. Join claim-app attribution.
5. Resolve CMS existence/raw/capped account targets in chunks of 50.
6. Fetch campaign metadata or events only for known CMS campaigns.
7. Report SUP, claim-app, CMS, missing, CMS-only, and attribution-only sets separately.

Prefer batched operations and bounded concurrency.

## Primary endpoints

- `GET https://claim.superfluid.org/api/programs`
- `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>`
- `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>`
- `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`
- `GET https://cms.superfluid.pro/points/events?...`
- `POST https://cms.superfluid.pro/points/balance-batch`
- `POST https://cms.superfluid.pro/points/signed-balance-batch`
- SUP subgraph: `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn`
- Base protocol subgraph: `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1`
- Optional ledger: `https://balances.superfluid.dev/v1/accounts/{account}/tokens/{token}/entries`

The exhaustive operational list is in `references/runtime-endpoints.md`.

## CMS OpenAPI boundary

`research/claim-app-sources/reconstructed/lib/cms-client.ts` is the sole CMS transport
boundary. Use generated path calls such as:

- `cmsClient.POST("/points/balance-batch", …)`
- `cmsClient.POST("/points/signed-balance-batch", …)`
- `cmsClient.GET("/points/events", …)`

Do not construct CMS URLs in claim components, chain-state helpers, or local API routes.
Validate account identity, campaign order, and parallel array lengths for every batch.
`@sfpro/sdk` 0.2.3 supplies contracts, not this CMS HTTP client.

## Build claim state

1. Import locker/factory ABIs and addresses from `@sfpro/sdk/abi/sup`.
2. Use Wagmi reads/hooks and `waitForTransactionReceipt`.
3. Resolve `getUserLocker(account)`.
4. Retain active SUP programs.
5. Fetch unsigned raw/capped values through `balance-batch` in chunks of 50.
6. Read `getUnitsPerProgram`, `getFlowRatePerProgram`, pool `getTotalUnits`, and
   `getTotalFlowRate`.
7. Mark a row claimable when the CMS campaign exists and capped target differs from
   onchain units.
8. On explicit submission, request `signed-balance-batch`, validate it, and submit
   signed `points`, campaign IDs, timestamp, and signature. Never submit
   `uncappedPoints`.
9. Require receipt `status: success`; refresh after partial multi-batch success.

## Show flows

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

Use `2,628,000` seconds per average month and label projections as estimates.

## Explain a pending uncapped delta

Use `client/pending-event-explanations.ts` from the reviewed claim state. Do not add a
local API proxy unless it provides a real server-only responsibility.

Procedure:

1. Filter the reviewed `PointState` rows to existing, changed, uncapped campaigns.
2. Pass the complete filtered set to the helper once; reuse each row's onchain units.
3. Request fresh `signed-balance-batch` values in chunks of 50 and validate them.
4. Reject the explanation if fresh raw or claimable values differ from the reviewed row.
5. Read only `getNextValidNonce(programId, account)` onchain for each row.
6. Derive `lastClaimNonce = nextValidNonce - 1` and use the fresh
   `signatureTimestamp` as `currentNonce`.
7. Require `currentNonce > lastClaimNonce`; an equal or older voucher is unusable.
8. Request events inside the inclusive nonce-derived `startTime`/`endTime` interval,
   newest first.
9. Add signed event points one at a time and stop at the first prefix equal to
   `uncappedPoints - onchainUnits`.
10. Return the selected events or an explicit partial-explanation message; group
    semantic event families in the UI.

The lower nonce is the signed balance snapshot last accepted onchain, not the claim
transaction's block time. To identify the actual claim transaction, inspect calldata and
verify its receipt/logs separately.

Boundary seconds are included because nonces have second resolution. CMS backfills can
still have an event time outside the nonce interval.

## Capped campaigns

The CMS raw/claimable pair is authoritative. When they differ:

- render `Capped out` prominently;
- show raw balance and claim target in details;
- state that additional activity will not increase this campaign's stream;
- skip incremental event retrieval;
- keep the state visible after synchronization;
- still submit the capped target if it is not yet onchain.

## Historical claim research

For transaction hash, caller, calldata, block time, or receipt status, use
`tools/sup-nonces/investigate-sup-nonces.js`, SUP indexed claims, and direct Base receipt
or SDK-defined log verification. Do not substitute snapshot nonce time for block time.

## Leaderboards

Use CMS campaign account/rank endpoints or claim-app leaderboard/search endpoints.
Prefer server-provided order/rank unless tie, cap, and exclusion rules are proven.

## Claim voucher tooling

- Sign through `signed-balance-batch`.
- Submit capped `points`.
- Independently verify onchain units for high-confidence conclusions.
- Reuse a voucher only when account, campaign IDs, targets, and nonce remain exact.

## Performance and evidence defaults

- Cache successful broad-scan responses.
- Chunk CMS balance/signature operations at 50.
- Use event pages of 100 and explicit page caps.
- Batch changed-campaign explanations once per wallet state.
- Fail explicitly rather than silently truncating.
- Preserve disagreements between live sources.

## Documentation synchronization

Update the skill, runtime inventory, reconciliation reference, research map,
reconstructed README/RUNNABILITY, and provenance together when claim behavior,
endpoints, ABIs, CMS operations, nonce/cap semantics, or authority changes.
