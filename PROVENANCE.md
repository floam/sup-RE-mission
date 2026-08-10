# Provenance

This file records external material and generated artifacts used by SUP Re:Mission.

## Whole-file vendoring

No complete file from the official Superfluid skill is vendored. The official skill
remains the source for protocol-wide ABIs, selectors, deployments, architecture, SDK
guidance, generic subgraph references, and reusable helpers.

## Embedded external interface fragments

The Wagmi 3 migration types in
`research/claim-app-sources/reconstructed/hooks/useLiquidityTransactions.ts` adapt the
ABI-derived typing approach from `superfluid-org/superfluid-dashboard` commit
`ee1af4ff25fba76d5ecfebe7cf0a1e3244f40bbd`. No Dashboard file is vendored.

`tools/sup-nonces/scan-sup-nonces.js` contains minimal ABI fragments for
`FluidLockerFactory.getUserLocker`, `FluidEPProgramManager.getNextValidNonce`, and
locker claim variants/events. They are intentionally narrow decoding/read surfaces.

The runnable claim path imports `lockerFactoryAddress`, `lockerFactoryAbi`, `lockerAbi`,
`programManagerAddress`, and `programManagerAbi` from `@sfpro/sdk/abi/sup` 0.2.3.
This is dependency use, not vendored source.

Program-manager nonce semantics were checked against
`superfluid-org/sup-token` commit
`91179958d5555ba47f68b0bb9a666cd2ac973e82`,
`packages/contracts/src/EPProgramManager.sol`:

- a successful single or batch update stores the submitted nonce in
  `_lastValidNonces[programId][user]`;
- `getNextValidNonce(programId, user)` returns that stored nonce plus one;
- a new nonce is valid only when greater than the stored nonce.

The reconstruction therefore derives the last applied signed snapshot as
`getNextValidNonce(...) - 1`. It does not describe that snapshot nonce as the claim
transaction's mined timestamp.

`research/claim-app-sources/reconstructed/contracts/app-contracts.ts` contains only the
GDA pool reads needed by restored behavior and flow projection:

- `getTotalAmountReceivedByMember(address)`
- `getMemberFlowRate(address)`
- `getTotalUnits()`
- `getTotalFlowRate()`

They were checked against `superfluid-org/protocol-monorepo` commit
`414109689d9041a8b6900b67b947f3f203c1da5d`, path
`packages/ethereum-contracts/contracts/interfaces/agreements/gdav1/ISuperfluidPool.sol`.
No complete pool ABI is vendored.

Base addresses, RPC/subgraph URLs, CMS routes, historical-balance APIs, and metrics URLs
are external deployment metadata.

## Repository-authored compatibility code

Local product/reconstruction modules include:

- `client/ClaimExperience.tsx`
- `client/ClaimCampaignChange.tsx`
- `client/claim-batch.ts`
- `client/claim-chain.ts`
- `client/claim-display.ts`
- `client/claim-event-breakdown.ts`
- `client/GroupedEventList.tsx`
- `client/event-groups.ts`
- `client/flow-projection.ts`
- `client/pending-event-explanations.ts`
- `lib/cms-client.ts`
- `lib/cms-events.ts`
- `lib/claim-nonce-window.ts`

`lib/cms-client.ts` is a small repository-authored `openapi-fetch` integration. Its
path/request/response types come from committed `lib/cms-openapi.d.ts`, generated from
`https://cms.superfluid.pro/points/openapi.json` using `openapi-typescript` 7.13.0.
The runtime uses `openapi-fetch` 0.17.0. `@sfpro/sdk` does not provide this HTTP client.

The generated CMS schema establishes:

- unsigned `points` are the true accumulated balance;
- unsigned `cappedPoints` are the claimable post-cap target;
- signed `uncappedPoints` and signed `points` are the same raw/claimable domains;
- signed `signatureTimestamp` is the nonce included in the voucher;
- capped accounts currently receive a one-unit target;
- events can be positive or negative and are ordered newest-first by `eventTime`,
  exposed as `createdAt`.

`client/pending-event-explanations.ts` is client-side orchestration. It reuses the
reviewed `PointState` rows, obtains fresh signed balances in validated chunks of 50,
rejects balance drift, reads only `getNextValidNonce` onchain, bounds CMS event time
between the last accepted signed nonce and the fresh signed nonce, and lazily sums the
bounded events until they explain `uncappedPoints - onchainUnits` or history is
exhausted. The claim UI filters out capped and synchronized rows before calling it.

No local pending-event API route or server-only Wagmi configuration remains. There was
no private credential, durable cache, authentication boundary, or server-only authority
to justify that proxy.

This is an arithmetic explanation of signed-snapshot change, not proof of the actual
claim transaction hash or block time. Those require transaction/receipt/log research.
CMS event time is not insertion time, so a backfill can still fall outside the window.

`balances.superfluid.dev` remains an optional ledger diagnostic and is not used for the
runnable claim decision or reconciliation path.

## Generated material

`research/claim-app-sources/reconstructed/lib/cms-openapi.d.ts` is generated and
committed so normal builds do not depend on live schema availability. Regenerate with
`npm run generate:cms-openapi`; the refresh workflow runs TypeScript, deterministic
tests, and live CMS/SUP coverage before committing a changed declaration.

`tools/point-events/point-event-names.html` is generated from public CMS, claim-app,
SUP subgraph, direct RPC, and protocol-subgraph responses. It is a dated report, not a
canonical registry.

### claim.superfluid.org deployment snapshot

`recovered/claim.superfluid.org/raw/` pins unauthenticated public responses from
deployment `dpl_CSoxxmednYKCCZSxAMCUZxSP89CC`, captured at
`2026-07-20T09:11:15.056Z` by GitHub Actions run `29730392853`, artifact `8456046548`
with digest
`sha256:ae42b5d1174c89c0d209afdf25e940134dede54366cda80a17531b37fc8e0b2f`.
`snapshot-manifest.json` records source URL, byte count, and SHA-256 for every response.

Raw files are authoritative. Complete `beautified/` copies are not tracked;
`snapshot-manifest.json` retains the Prettier 3.6.2 settings and expected derivative
byte counts and SHA-256 values. `npm run verify:claim-snapshot` regenerates those
formatting-only derivatives in a temporary directory, verifies them against the
manifest, and discards them after the check.

## Adding external material

Record source repository/path, exact revision, reason, local modifications, and refresh
procedure for every future vendored file or substantial copied fragment.

## Claim-app source recovery

`research/claim-app-sources/use-claim-transaction.recovered.ts` is a repository-authored
semantic reconstruction derived from public deployment chunk
`/_next/static/chunks/9443-ee8d2452e07f5651.js` (Sentry debug ID
`131b676a-515c-4305-b4d2-ed8d8eef7317`). The deployment did not publish a usable source
map. No minified JavaScript or whole third-party generated client is committed.
