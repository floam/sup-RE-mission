# SUP Re:Mission

A research workbench for Superfluid points, emission programs, campaign discovery,
point events, claim vouchers, SUP nonce behavior, public claim-app sources, and a
runnable semantic reconstruction of the claim experience.

## What is here

- `research/claim-app-sources/reconstructed/`: runnable Next.js reconstruction with
  SDK/Wagmi claim state, a typed CMS OpenAPI client, current/projected SUP flows,
  nonce-bounded pending-event explanations, capped-campaign UX, and Base submission.
- `tools/claim-voucher/`: Safari Shortcuts-compatible claim-voucher injector.
- `tools/point-events/`: live campaign discovery and point-event catalog export.
- `tools/sup-nonces/`: Base claim-history and nonce analysis utility.
- `tools/claim-source-recovery/`: provenance-aware public deployment capture tools.
- `research/`: dated endpoint audits, security analysis, and reconstruction notes.
- `skills/superfluid-points-research/`: focused points-research skill.
- `RESEARCH-MAP.md`: task-to-reference map.
- `PROVENANCE.md`: external-source and generated-artifact record.

## Commands

```sh
npm install
npm run export:point-events
npm run scan:nonces -- --user 0x... --program-ids 607
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

Production verification:

```sh
npm run build
npm start
```

The official Superfluid skill is expected to be installed separately for general
protocol knowledge, full protocol references, and reusable protocol helpers.

## Claim reconstruction architecture

The current claim experience:

- enumerates SUP programs through the Goldsky SUP subgraph and compares active programs;
- reads raw and capped targets through `POST /points/balance-batch` for claim-state
  assembly and validates account, campaign order, and parallel arrays;
- imports locker, factory, and program-manager contracts from `@sfpro/sdk/abi/sup`;
- uses Wagmi for locker/pool/nonce reads, chain switching, writes, and receipt confirmation;
- shows current and projected `SUP/month` flows, retaining units as technical detail;
- marks `uncappedPoints !== claimable points` as a first-class capped-out state and does
  not load incremental events for capped campaigns;
- sends all changed uncapped rows to one client helper, which reuses their onchain units
  instead of repeating claim-state or locker reads;
- batches fresh signed balances, reads `getNextValidNonce(programId, account) - 1` as
  the last signed balance snapshot applied onchain, and lazily sums newest CMS events
  inside the nonce window until they match `uncappedPoints - onchainUnits`;
- signs only changed campaigns through `POST /points/signed-balance-batch`, requires a
  successful receipt, and refreshes state after a partial multi-batch claim.

The nonce interval bounds signed balance snapshots. It does not identify the previous
claim transaction's hash or mined timestamp; those require transaction/receipt/log
research. CMS event `createdAt` is `eventTime`, not insertion time, so a backfill can
still fall outside the interval.

No local pending-event API route remains. The explanation path uses the browser's
existing Wagmi configuration and public CMS client directly, avoiding duplicate locker,
program, and unit reads and removing an unauthenticated request-fanout endpoint.

`research/claim-app-sources/reconstructed/lib/cms-client.ts` is the sole CMS transport
boundary. It is repository-authored against the CMS OpenAPI contract; `@sfpro/sdk`
0.2.3 supplies contract ABIs/hooks/actions but no CMS HTTP client.

See
[`research/claim-app-sources/reconstructed/RUNNABILITY.md`](research/claim-app-sources/reconstructed/RUNNABILITY.md)
for exact behavior and limitations.

## Claim-app sources

The pinned public-response snapshot is documented in
[`recovered/claim.superfluid.org/`](recovered/claim.superfluid.org/). Raw responses are
hash-verified by `npm run verify:claim-snapshot`; the readable semantic reconstruction
lives under `research/claim-app-sources/reconstructed/`.

For a provenance-aware live recovery, use a separate output directory:

```bash
npm run recover:claim-sources -- --out /tmp/claim-live-recovery
```
