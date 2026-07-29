# SUP Re:Mission

A research workbench for Superfluid points, emission programs, campaign discovery,
point events, claim vouchers, SUP nonce behavior, public claim-app evidence, and a
runnable semantic reconstruction of the claim experience.

## What is here

- `research/claim-app-sources/reconstructed/`: runnable Next.js reconstruction with
  SDK/Wagmi claim state, a typed CMS OpenAPI client boundary, current/projected SUP flows,
  grouped pending-claim events, and Base transaction submission.
- `tools/claim-voucher/`: Safari Shortcuts-compatible claim-voucher injector.
- `tools/point-events/`: live campaign discovery and point-event evidence export. See
  its [tool guide](tools/point-events/README.md).
- `tools/sup-nonces/`: Base claim-history and nonce investigation utility. See its
  [tool guide](tools/sup-nonces/README.md).
- `tools/claim-source-recovery/`: provenance-aware capture, formatting, and
  verification utilities for the public claim-app deployment.
- `research/`: dated endpoint audits, security analysis, and semantic reconstruction.
- `skills/superfluid-points-research/`: focused Codex skill.
- `skills/superfluid-points-research/references/endpoints.md`: detailed public API
  response and error catalog.
- `skills/superfluid-points-research/references/runtime-endpoints.md`: exact runtime
  route inventory, CMS OpenAPI client mapping, optional balances API, SDK/Wagmi procedures, and
  pending-claim workflow.
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

Run the reconstructed app:

```sh
cd research/claim-app-sources/reconstructed
npm ci
npm test
npm run test:e2e
npm run dev
```

For a production verification:

```sh
npm run build
npm start
```

`npm run build:skill` writes `dist/superfluid-points-research.zip` for manual skill
installation. The archive contains only `skills/superfluid-points-research/`
contents and excludes injector files.

The official Superfluid skill is expected to be installed separately for general
protocol knowledge, full protocol references, and reusable protocol helpers.

`export:point-events` performs live network requests and updates generated HTML
evidence and `.cache/point-event-names.json`. Review the evidence before committing.
`test:nonces` is also a live Base RPC and CMS smoke test.

`recover:claim-sources` refuses to overwrite a non-empty directory unless that
directory has its recovery ownership marker. The repository's pinned snapshot is
evidence, not a normal recovery output; use a separate `--out` directory when
checking the live deployment.

## Claim reconstruction architecture

The current claim experience:

- enumerates SUP programs through the Goldsky SUP subgraph and compares only active
  programs;
- reads capped targets through `cmsClient.POST("/points/balance-batch", …)` and validates response account,
  campaign order, and parallel array lengths;
- imports locker/factory contracts from `@sfpro/sdk/abi/sup`;
- uses Wagmi for locker reads, claim-event verification, chain switching, writes, and
  receipt confirmation;
- shows current and projected `SUP/month` flows, with units retained as technical
  detail;
- uses local `/api/pending-claim-events` to request events only after a SUP-subgraph
  claim candidate is verified through an SDK-defined locker event on Base;
- signs only changed campaigns through `cmsClient.POST("/points/signed-balance-batch", …)`, requires successful
  receipts, and refreshes state after a partial multi-batch claim.

`research/claim-app-sources/reconstructed/lib/cms-client.ts` is the sole CMS transport
boundary for the runnable claim path. Application modules do not construct CMS
`/points/*` URLs directly. This repository client is not an `@sfpro/sdk` export;
version `0.2.3` supplies the contract ABI/hooks/actions surface but no CMS HTTP client.

An indexed locker claim is not automatically a proven claim timestamp. The route
requires a matching SDK-defined onchain event, and it keeps an unresolved boundary
explicit rather than silently presenting full campaign history as “this claim.”

The CMS events route filters `eventTime` and exposes it under the compatibility field
name `createdAt`. The pending-event panel is therefore event-time-bounded; a backfilled
record inserted later with an earlier event time can be absent.

See
[`research/claim-app-sources/reconstructed/RUNNABILITY.md`](research/claim-app-sources/reconstructed/RUNNABILITY.md)
for exact behavior and limitations.

## Claim-app source evidence

The pinned public-response snapshot is documented in
[`recovered/claim.superfluid.org/`](recovered/claim.superfluid.org/). Its raw
responses are hash-verified by `npm run verify:claim-snapshot`; the semantic readable
reconstruction lives in
[`research/claim-app-sources/reconstructed/`](research/claim-app-sources/reconstructed/).

For a provenance-aware live recovery, which writes raw deployment assets only to a
separate output directory, run:

```bash
npm run recover:claim-sources -- --out /tmp/claim-live-recovery
```

For a metadata-only audit that does **not** write minified JavaScript, use:

```bash
node tools/claim-app-sources/recover-claim-app-sources.mjs \
  --write-inventory research/claim-app-sources/chunk-inventory.md \
  --write-source-catalog research/claim-app-sources/source-catalog.md
```

It can refresh the Markdown inventory and source catalog, but it does not replace
the provenance-aware snapshot recovery workflow.
