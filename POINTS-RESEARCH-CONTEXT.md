# Superfluid points investigation map

Use this after the `superfluid-points-research` skill activates. Load the smallest relevant group. Files outside `SKILL.md` are not guaranteed to enter agent context merely because they exist.

## Shortcuts injector

- `docs/tools/claim-voucher-shortcuts.js`: complete browser/Apple Shortcuts injector.
- `docs/tools/claim-voucher-shortcuts.md`: installation, behavior, and operational notes.

## Campaign and endpoint discovery

- `.agents/skills/superfluid-points-research/references/endpoints.md`: endpoint catalog and interpretation rules.
- `docs/audits/2026-06-30-spr-campaigns-claim-endpoints.md`: reverse-engineering and audit findings.
- `cms/src/scripts/export-point-event-names.ts`: live campaign/program discovery and event enumeration.

## Point-event evidence

- `cms/src/scripts/export-point-event-names.ts`: discovery, caching, coalescing, and HTML generation.
- `website/public/point-event-names.html`: generated observed-event catalog.

## Claim vouchers

- `docs/tools/claim-voucher-shortcuts.js`
- `docs/tools/claim-voucher-shortcuts.md`
- `.agents/skills/superfluid-points-research/references/endpoints.md`

## Nonce and claim-history research

- `docs/security/fluid-ep-nonce-staleness-assessment.md`: conclusions, threat model, and evidence limits.
- `sdk/package/scripts/investigate-sup-nonces.js`: transaction/log scanner and calldata decoder.
- `sdk/package/tests/investigate-sup-nonces.live.test.ts`: live smoke-test example.
- `.github/workflows/investigate-sup-nonces-bundle.yml`: portable JavaScriptCore/a-Shell bundle workflow.

## Sparse-overlay rule

The upstream repository is deliberately absent from history. A file inherited from upstream enters this repository only in the first commit that changes it, containing the complete post-change file. If it returns to the upstream baseline, it disappears from the overlay again.

Use the separately installed general `superfluid` skill for contract ABIs, selectors, generic protocol subgraphs, SDK guidance, and architecture.
