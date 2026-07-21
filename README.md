# SUP Re:Mission

A research workbench for Superfluid points, emission programs, campaign discovery,
point events, claim vouchers, SUP nonce behavior, and public claim-app evidence.

## What is here

- `tools/claim-voucher/`: Safari Shortcuts-compatible claim-voucher injector.
- `tools/point-events/`: live campaign discovery and point-event evidence export. See its [tool guide](tools/point-events/README.md).
- `tools/sup-nonces/`: Base claim-history and nonce investigation utility. See its [tool guide](tools/sup-nonces/README.md).
- `tools/claim-source-recovery/`: provenance-aware capture, formatting, and verification utilities for the public claim-app deployment.
- `research/`: dated endpoint audits, security analysis, and semantic claim-app reconstruction.
- `skills/superfluid-points-research/`: the focused Codex skill.
- `RESEARCH-MAP.md`: task-to-evidence map.
- `PROVENANCE.md`: external-source and generated-artifact record.

## Commands

```sh
npm install
npm run export:point-events
npm run investigate:nonces -- --user 0x... --program-ids 607
npm run test:nonces
npm run bundle:nonces
npm run build:skill
npm run verify:claim-snapshot
npm run recover:claim-sources -- --out /tmp/claim-live-recovery
```

`npm run build:skill` writes `dist/superfluid-points-research.zip` for manual skill installation. The archive contains only `skills/superfluid-points-research/` contents and excludes any injector files.

The official Superfluid skill is expected to be installed separately for general protocol knowledge and reusable protocol references.

`export:point-events` performs live network requests and updates both the generated
HTML evidence and `.cache/point-event-names.json`. Review the resulting evidence
before committing it. `test:nonces` is also a live Base RPC and CMS smoke test.

`recover:claim-sources` refuses to overwrite a non-empty directory unless that
directory has its recovery ownership marker. The repository's pinned snapshot is
evidence, not a normal recovery output; use a separate `--out` directory when
checking the live deployment.

## Claim-app source evidence

The pinned public-response snapshot is documented in
[`recovered/claim.superfluid.org/`](recovered/claim.superfluid.org/). Its raw
responses are hash-verified by `npm run verify:claim-snapshot`; the semantic,
readable reconstruction lives in
[`research/claim-app-sources/reconstructed/`](research/claim-app-sources/reconstructed/).

For a provenance-aware live recovery, which writes raw deployment assets only to
the separate output directory, run:

```bash
npm run recover:claim-sources -- --out /tmp/claim-live-recovery
```

For a metadata-only audit that does **not** write minified JavaScript, use the
older inventory helper:

```bash
node tools/claim-app-sources/recover-claim-app-sources.mjs \
  --write-inventory research/claim-app-sources/chunk-inventory.md \
  --write-source-catalog research/claim-app-sources/source-catalog.md
```

It can refresh the Markdown inventory and source catalog, but it does not replace
the provenance-aware snapshot recovery workflow.
