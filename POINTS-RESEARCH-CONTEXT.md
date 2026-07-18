# Superfluid points investigation map

Use this after the `superfluid-points-research` skill activates. Load the smallest relevant group. Files outside `SKILL.md` are not guaranteed to enter agent context merely because they exist.

## Shortcuts injector

- `docs/tools/claim-voucher-shortcuts.js`: complete browser/Apple Shortcuts injector.
- `docs/tools/claim-voucher-shortcuts.md`: installation, behavior, and operational notes.

## Campaign and endpoint discovery

- `.agents/skills/superfluid-points-research/references/endpoints.md`: endpoint catalog and interpretation rules.
- `docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`: reverse-engineering and audit findings.
- `cms/src/app/(api)/points/`: preserved implementations of the relevant public points routes.
- `cms/src/domains/points/api/schemas.ts`: API schemas.
- `cms/src/domains/points/types.ts`: response and domain types.

## Point-event enumeration and evidence

- `cms/src/scripts/export-point-event-names.ts`: discovery, enumeration, caching, coalescing, and HTML generation.
- `website/public/point-event-names.html`: generated observed-event catalog.
- `cms/src/domains/points/collections/PointEvents.ts`: persistence behavior.
- `docs/plans/completed/2026-05-27-points-api-perf.md`: endpoint correctness and scaling rationale.

## Claim vouchers

- `docs/tools/claim-voucher-shortcuts.md`
- `docs/tools/claim-voucher-shortcuts.js`
- `cms/src/app/(api)/points/signed-balance/route.ts`
- `cms/src/app/(api)/points/signed-balance-batch/route.ts`
- `cms/src/domains/points/utils/signing.ts`
- `cms/src/domains/points/utils/points-cap.ts`

## Nonce and claim-history research

- `docs/security/fluid-ep-nonce-staleness-assessment.md`: conclusions, threat model, and evidence limits.
- `sdk/package/scripts/investigate-sup-nonces.js`: transaction/log scanner and calldata decoder.
- `sdk/package/tests/investigate-sup-nonces.live.test.ts`: live smoke-test example.
- `.github/workflows/investigate-sup-nonces-bundle.yml`: portable JavaScriptCore/a-Shell bundle workflow.

## CMS behavior snapshots

- `cms/src/domains/points/collections/`: campaign, balance, and event persistence.
- `cms/src/domains/points/trigger/`: ingestion, synchronization, retries, and migration behavior.
- `cms/src/domains/points/utils/`: signing and points-cap logic.

The retained `cms/`, `sdk/`, and `website/` paths are source snapshots and investigation tools, not complete runnable upstream applications.

## Adjacent general Superfluid skill

Use the separately installed general `superfluid` skill for contract ABIs, selectors, generic protocol subgraphs, SDK guidance, and architecture. Those materials are deliberately absent here.
