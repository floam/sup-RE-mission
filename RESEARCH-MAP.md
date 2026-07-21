# Research map

Load the smallest relevant group for the question at hand.

## Claim voucher injector

- `tools/claim-voucher/injector.js`: complete browser and Apple Shortcuts payload.
- `tools/claim-voucher/README.md`: endpoint choices, cache rules, and operating notes.

## Campaign and endpoint discovery

- `skills/superfluid-points-research/references/endpoints.md`: endpoint catalog and interpretation rules.
- `research/2026-06-30-spr-campaigns-claim-endpoints.md`: public-app endpoint audit.
- `tools/point-events/export-point-event-names.ts`: live campaign and program discovery.

## Point-event evidence

- `tools/point-events/export-point-event-names.ts`: discovery, caching, coalescing, and HTML generation.
- `tools/point-events/point-event-names.html`: generated observed-event catalog.

## Nonce and claim-history research

- `research/fluid-ep-nonce-staleness-assessment.md`: threat model, conclusions, and evidence limits.
- `tools/sup-nonces/investigate-sup-nonces.js`: transaction and log scanner with calldata decoding.
- `tools/sup-nonces/investigate-sup-nonces.live.test.ts`: live smoke test.
- `.github/workflows/build-sup-nonce-bundle.yml`: portable JavaScriptCore and a-Shell bundle.

## General protocol questions

Use the separately installed official `superfluid` skill. Do not reproduce its ABIs, selectors, address catalogs, architecture guides, SDK documentation, generic subgraph references, or helper scripts here.
