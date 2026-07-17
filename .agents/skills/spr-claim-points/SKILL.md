---
name: spr-claim-points
description: Inspect or build Superfluid Points Rewards claim flows, claim point states, signed balances, claim vouchers, claim-app /api/points/states and /api/points/claim, CMS signed-balance-batch, and claim-voucher tooling. Use for claiming points, voucher payloads, stale onchain units, canClaim, and selected campaign claim transactions.
---

# SPR claim points

Use this skill for claimability, voucher, and signed-balance tasks.

## Canonical claim flow sources

1. `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>` for visible claim state rows.
2. `GET https://claim.superfluid.org/api/programs` for campaign labels and program metadata.
3. `POST https://cms.superfluid.pro/points/signed-balance-batch` for actual selected-subset vouchers.
4. `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>` for optional reference/debug claim-app payloads.
5. `POST https://cms.superfluid.pro/points/balance-batch` for diagnostics comparing CMS raw/capped balances with claim states.

## Interpretation

Observed state rows use:

```json
{ "programId": 611, "offchainPoints": "...", "onchainPoints": "...", "isOnchainOutdated": true }
```

- `offchainPoints` is the CMS signed/capped target units for the account/program.
- `onchainPoints` is the current onchain pool member units.
- `isOnchainOutdated` means the signed CMS target differs from onchain units and a claim/update can be useful.
- Claim transactions submit full target units, not just the delta.
- `uncappedPoints` from CMS is diagnostic only; do not submit it as claim units.

## Voucher correctness

- Use the same account, ordered campaign IDs, points array, and `signatureTimestamp`/nonce returned by CMS.
- A cached voucher is reusable only for the same selected program set and exact current target totals.
- Do not mix a claim-app reference signature with a different selected CMS campaign subset.
- Do not use SUP/protocol subgraphs for signing payloads; they are research/enrichment sources only.

## Existing tooling

- `docs/tools/claim-voucher-shortcuts.js` injects a Safari Shortcuts-compatible UI into `https://claim.superfluid.org`.
- `docs/tools/claim-voucher-shortcuts.md` documents its endpoints, cache assumptions, and arm/intercept behavior.

## Minimal CMS signed-batch request

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611]
}
```

Reference shared endpoint details in `../superfluid-points-research/references/endpoints.md` when exact request/response shapes are needed.
