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
- `tools/point-events/README.md`: invocation, source layering, coverage, and output rules.
- `tools/point-events/point-event-names.html`: generated observed-event catalog.

## Nonce and claim-history research

- `research/fluid-ep-nonce-staleness-assessment.md`: threat model, conclusions, and evidence limits.
- `tools/sup-nonces/investigate-sup-nonces.js`: transaction and log scanner with calldata decoding.
- `tools/sup-nonces/investigate-sup-nonces.live.test.ts`: live smoke test.
- `tools/sup-nonces/README.md`: invocation, live-test constraints, and decoding limits.
- `.github/workflows/build-sup-nonce-bundle.yml`: portable JavaScriptCore and a-Shell bundle.

## Claim-app deployment evidence and reconstruction

- `recovered/claim.superfluid.org/README.md`: pinned-snapshot layout and verification.
- `tools/claim-source-recovery/README.md`: live recovery command, safety boundary, and output layout.
- `research/claim-app-sources/reconstructed/README.md`: reconstruction scope and evidence policy.
- `research/claim-app-sources/reconstructed/RUNNABILITY.md`: standalone-app gaps and shortest compatibility path.

## General protocol questions

Use the separately installed official `superfluid` skill. Do not reproduce its ABIs, selectors, address catalogs, architecture guides, SDK documentation, generic subgraph references, or helper scripts here.
