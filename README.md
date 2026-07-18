# Superfluid points investigation kit

This fork is no longer a mirror of `superfluid-org/superfluid.pro`. Its working tree contains only:

- the claim-voucher browser/Apple Shortcuts injector;
- the `superfluid-points-research` Codex skill;
- focused research, generated evidence, investigation scripts, tests, and narrow CMS source snapshots.

The deleted upstream applications and monorepo tooling remain available from upstream Git history. They are intentionally absent from the current tree.

## Injector

The complete payload is at `docs/tools/claim-voucher-shortcuts.js`. Read `docs/tools/claim-voucher-shortcuts.md` before running it against `claim.superfluid.org`.

## Investigation commands

Requires Node.js 22 or newer.

```sh
npm install
npm run export:point-events
npm run investigate:nonces -- --user 0x... --program-ids 607
npm run test:nonces
npm run bundle:nonces
```

The point-event exporter writes `website/public/point-event-names.html` and caches network responses under `.cache/`.

The retained `cms/`, `sdk/`, and `website/` paths are partial snapshots and tools, not complete applications.

Start with `AGENTS.md` and `POINTS-RESEARCH-CONTEXT.md` when using Codex.
