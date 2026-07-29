# Research map

Load the smallest relevant group for the question at hand.

## Claim UX, claim state, flows, and pending events

- `research/claim-app-sources/reconstructed/RUNNABILITY.md`: current SDK/Wagmi/CMS-SDK architecture, flow projection, local API boundary, verification, and limitations.
- `research/claim-app-sources/reconstructed/client/ClaimExperience.tsx`: staged account review, ownership-aware submission, and batch claim orchestration.
- `research/claim-app-sources/reconstructed/client/ClaimCampaignChange.tsx`: per-campaign current/projected flows and event-time-bounded explanation.
- `research/claim-app-sources/reconstructed/client/claim-chain.ts`: active CMS target plus SDK/Wagmi onchain state assembly.
- `research/claim-app-sources/reconstructed/client/claim-batch.ts`: CMS account/order/parallel-array validation.
- `research/claim-app-sources/reconstructed/lib/cms-client.ts`: sole typed CMS transport boundary for the runnable claim path.
- `research/claim-app-sources/reconstructed/app/api/pending-claim-events/route.ts`: indexed-and-RPC-verified claim boundary plus bounded CMS event join.
- `skills/superfluid-points-research/references/runtime-endpoints.md`: exact operational endpoint inventory and procedures.

Use this group for questions such as:

- What is about to be claimed, and what evidence supports the explanation?
- What event rows should appear in the claim UI?
- What was the last verified claim boundary?
- What are the current and projected SUP flows?
- Which SDK/Wagmi/CMS-SDK calls should implement the transaction?

Remember that CMS event `createdAt` is the API name for `eventTime`, not record
insertion time. A time-bounded result can omit a later-inserted backfill whose event
time predates the claim.

## Claim voucher injector

- `tools/claim-voucher/injector.js`: complete browser and Apple Shortcuts payload.
- `tools/claim-voucher/README.md`: endpoint choices, cache rules, and operating notes.

## Campaign and endpoint discovery

- `skills/superfluid-points-research/references/endpoints.md`: detailed public endpoint response/error catalog.
- `skills/superfluid-points-research/references/runtime-endpoints.md`: current route inventory, CMS OpenAPI client mapping, optional balances API, external services, SDK/Wagmi claim procedure, and local compatibility endpoint.
- `research/2026-06-30-spr-campaigns-claim-endpoints.md`: dated public-app endpoint audit.
- `tools/point-events/export-point-event-names.ts`: live campaign and program discovery.

## Point-event evidence

- `tools/point-events/export-point-event-names.ts`: discovery, caching, coalescing, and HTML generation.
- `tools/point-events/README.md`: invocation, source layering, coverage, and output rules.
- `tools/point-events/point-event-names.html`: generated observed-event catalog.
- `research/claim-app-sources/reconstructed/client/event-groups.ts`: compact semantic-family grouping used by pending-claim explanations.

## Nonce and claim-history research

- `research/fluid-ep-nonce-staleness-assessment.md`: threat model, conclusions, and evidence limits.
- `tools/sup-nonces/investigate-sup-nonces.js`: transaction and log scanner with calldata decoding.
- `tools/sup-nonces/investigate-sup-nonces.live.test.ts`: live smoke test.
- `tools/sup-nonces/README.md`: invocation, live-test constraints, and decoding limits.
- `.github/workflows/build-sup-nonce-bundle.yml`: portable JavaScriptCore and a-Shell bundle.

For a true “last claim” timestamp, prefer SUP-subgraph locker claim entities verified
against SDK-defined locker events through Base RPC. The historical balances service is
an optional ledger diagnostic, not a claim-history index.

## Claim-app deployment evidence and reconstruction

- `recovered/claim.superfluid.org/README.md`: pinned-snapshot layout and verification.
- `tools/claim-source-recovery/README.md`: live recovery command, safety boundary, and output layout.
- `research/claim-app-sources/reconstructed/README.md`: recovered-versus-compatibility scope and evidence policy.
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`: standalone app operation and current compatibility architecture.
- `research/claim-app-sources/reconstructed/MODULE_MAP.md`: recovered symbol/evidence ledger.

## Documentation synchronization

When a branch changes claim behavior, endpoints, CMS OpenAPI client operations, ABI fragments,
flow math, or data-source authority, update the points skill, endpoint inventory,
runnability notes, reconstruction README, research map, and provenance in the same
branch. Do not leave exact test counts, obsolete route names, or deleted component
names in durable documentation.

## General protocol questions

Use the separately installed official `superfluid` skill. Do not reproduce its full
ABIs, selectors, address catalogs, architecture guides, generic SDK documentation,
standard subgraph references, or helper scripts here.
