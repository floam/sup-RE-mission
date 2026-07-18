# Superfluid points context index

Use this map after the `superfluid-points-research` skill activates. Read only the group relevant to the task, but do not assume an unmentioned file will be loaded automatically.

## Campaign and endpoint discovery

- `references/endpoints.md`: operational endpoint catalog, source hierarchy, known IDs, and interpretation rules.
- `../../../../docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`: reverse-engineering and audit findings for SPR campaign and claim endpoints.
- `../../../../cms/src/app/(api)/points/`: exact CMS route implementations.
- `../../../../cms/src/domains/points/api/`: OpenAPI schemas and registry.
- `../../../../cms/src/domains/points/types.ts`: response and domain types.

## Point-event enumeration and evidence

- `../../../../cms/src/scripts/export-point-event-names.ts`: campaign discovery, event enumeration, caching, coalescing, and HTML generation script.
- `../../../../website/public/point-event-names.html`: generated evidence catalog from the exporter. Prefer this for known observed event names; rerun the script when freshness matters.
- `../../../../cms/src/domains/points/collections/PointEvents.ts`: point-event persistence behavior.
- `../../../../docs/plans/completed/2026-05-27-points-api-perf.md`: endpoint performance/correctness rationale and known scaling constraints.

## Claim vouchers

- `../../../../docs/tools/claim-voucher-shortcuts.md`: usage and behavior documentation.
- `../../../../docs/tools/claim-voucher-shortcuts.js`: complete browser/Shortcuts injector.
- `../../../../cms/src/app/(api)/points/signed-balance/route.ts`
- `../../../../cms/src/app/(api)/points/signed-balance-batch/route.ts`
- `../../../../cms/src/domains/points/utils/signing.ts`
- `../../../../cms/src/domains/points/utils/points-cap.ts`

## Nonce and claim-history research

- `../../../../docs/security/fluid-ep-nonce-staleness-assessment.md`: conclusions, threat model, and evidence boundaries.
- `../../../../sdk/package/scripts/investigate-sup-nonces.js`: transaction/log scanner and calldata decoder.
- `../../../../sdk/package/tests/investigate-sup-nonces.live.test.ts`: live usage example and expected output shape.
- `../../../../.github/workflows/investigate-sup-nonces-bundle.yml`: portable bundle workflow.

## Points data model and behavior

- `../../../../cms/src/domains/points/collections/`: campaigns, point events, balances, API keys, and push requests.
- `../../../../cms/src/domains/points/trigger/`: ingestion, synchronization, retries, and migration logic.
- `../../../../cms/src/payload-drizzle-schema.ts`: generated database table definitions used by aggregate routes.
- `../../../../cms/src/payload-types.ts`: generated Payload types referenced by the domain code.

## Adjacent main Superfluid skill

Assume the general `superfluid` skill is installed beside this one. Use it for protocol-wide contract ABIs, selectors, subgraph schemas, SDK guides, and generic Superfluid architecture. Those files are intentionally not duplicated here.
