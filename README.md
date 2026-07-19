# SUPREmission 

A hacking and research workbench for Superfluid points, emission programs, campaign discovery, point events, claim vouchers, and SUP nonce behavior.

## What is here

- `tools/claim-voucher/`: Safari Shortcuts-compatible claim-voucher injector.
- `tools/point-events/`: campaign discovery and point-event evidence generator.
- `tools/sup-nonces/`: Base claim-history and nonce investigation tooling.
- `research/`: endpoint audits and security analysis.
- `.agents/skills/superfluid-points-research/`: the focused Codex skill.
- `RESEARCH-MAP.md`: task-to-evidence map.
- `PROVENANCE.md`: external-source and generated-artifact record.

## Commands

```sh
npm install
npm run export:point-events
npm run investigate:nonces -- --user 0x... --program-ids 607
npm run test:nonces
npm run bundle:nonces
```

The official Superfluid skill is expected to be installed separately for general protocol knowledge and reusable protocol references.
