# Research map

Load the smallest relevant group for the question at hand.

## Claim UX, claim state, flows, caps, and pending-event explanations

- `research/claim-app-sources/reconstructed/RUNNABILITY.md`: current SDK/Wagmi/OpenAPI architecture, flow projection, local API boundary, verification, and limitations.
- `research/claim-app-sources/reconstructed/client/ClaimExperience.tsx`: staged account review, ownership-aware submission, batched explanation loading, and client explanation cache.
- `research/claim-app-sources/reconstructed/client/ClaimCampaignChange.tsx`: per-campaign current/projected flows, capped-out state, and event reconciliation UI.
- `research/claim-app-sources/reconstructed/client/claim-chain.ts`: active CMS uncapped/capped targets plus SDK/Wagmi onchain state assembly.
- `research/claim-app-sources/reconstructed/client/claim-batch.ts`: CMS account/order/parallel-array validation.
- `research/claim-app-sources/reconstructed/lib/cms-client.ts`: sole typed CMS transport boundary for the runnable claim path.
- `research/claim-app-sources/reconstructed/lib/cms-events.ts`: nonce-bounded newest-first event pagination and lazy signed-point reconciliation.
- `research/claim-app-sources/reconstructed/lib/claim-nonce-window.ts`: derives the last applied signed snapshot and fresh upper snapshot boundary.
- `research/claim-app-sources/reconstructed/app/api/pending-claim-events/route.ts`: wallet-level batched explanation endpoint; one locker lookup, chunked signed balances, program-manager nonce reads, and per-campaign event prefixes only when meaningful.
- `skills/superfluid-points-research/references/pending-event-reconciliation.md`: authoritative explanation, nonce-boundary, and cap procedure.
- `skills/superfluid-points-research/references/runtime-endpoints.md`: broader operational endpoint inventory.

Use this group for questions such as:

- What is about to be claimed, and what arithmetic supports the explanation?
- Which newest CMS events inside the signed-snapshot interval reconcile the delta?
- What was the last signed balance snapshot applied onchain?
- Has CMS capped the campaign target?
- What are the current and projected SUP flows?
- Which SDK/Wagmi/OpenAPI calls implement the transaction?

For an uncapped campaign, the runnable UI computes `uncapped CMS points - onchain
units`. It derives the lower event-time bound from
`getNextValidNonce(programId, account) - 1`, derives the upper bound from a fresh
signed-balance `signatureTimestamp`, and stops at the first newest-first event prefix
whose signed sum equals the difference. This identifies snapshot bounds, not the claim
transaction's mined timestamp. If bounded history is exhausted first, the UI reports
partial reconciliation.

When CMS returns different uncapped and claimable values, the campaign is shown as
capped out and event additions are not requested because they no longer increase the
claim target. CMS event `createdAt` remains the API name for `eventTime`, not insertion
time.

## Claim voucher injector

- `tools/claim-voucher/injector.js`: complete browser and Apple Shortcuts payload.
- `tools/claim-voucher/README.md`: endpoint choices, cache rules, and operating notes.

## Campaign and endpoint discovery

- `skills/superfluid-points-research/references/endpoints.md`: detailed public endpoint response/error catalog.
- `skills/superfluid-points-research/references/runtime-endpoints.md`: runtime route inventory, CMS OpenAPI mapping, program-manager nonce boundary, optional balances API, and SDK/Wagmi procedures.
- `research/2026-06-30-spr-campaigns-claim-endpoints.md`: dated public-app endpoint audit.
- `tools/point-events/export-point-event-names.ts`: live campaign and program discovery.

## Point-event evidence

- `tools/point-events/export-point-event-names.ts`: discovery, caching, coalescing, and HTML generation.
- `tools/point-events/README.md`: invocation, source layering, coverage, and output rules.
- `tools/point-events/point-event-names.html`: generated observed-event catalog.
- `research/claim-app-sources/reconstructed/client/event-groups.ts`: compact semantic-family grouping used by claim explanations.

## Nonce and historical claim research

- `research/fluid-ep-nonce-staleness-assessment.md`: threat model, conclusions, and evidence limits.
- `tools/sup-nonces/investigate-sup-nonces.js`: transaction and log scanner with calldata decoding.
- `tools/sup-nonces/investigate-sup-nonces.live.test.ts`: live smoke test.
- `tools/sup-nonces/README.md`: invocation, live-test constraints, and decoding limits.
- `.github/workflows/build-sup-nonce-bundle.yml`: portable JavaScriptCore and a-Shell bundle.

`getNextValidNonce - 1` proves the nonce of the last accepted signed balance for a
program/user. It does not identify its transaction hash or mined timestamp. For those,
locate and decode the claim transaction and verify its successful receipt or logs.

## Claim-app deployment evidence and reconstruction

- `recovered/claim.superfluid.org/README.md`: pinned-snapshot layout and verification.
- `tools/claim-source-recovery/README.md`: live recovery command, safety boundary, and output layout.
- `research/claim-app-sources/reconstructed/README.md`: recovered-versus-compatibility scope and evidence policy.
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`: standalone app operation and current compatibility architecture.
- `research/claim-app-sources/reconstructed/MODULE_MAP.md`: recovered symbol/evidence ledger.

## Documentation synchronization

When a branch changes claim behavior, endpoints, CMS OpenAPI operations, ABI fragments,
flow math, nonce or cap semantics, or data-source authority, update the points skill,
endpoint inventory, reconciliation reference, runnability notes, reconstruction README,
research map, and provenance in the same branch.

## General protocol questions

Use the separately installed official `superfluid` skill. Do not reproduce its full
protocol reference here.
