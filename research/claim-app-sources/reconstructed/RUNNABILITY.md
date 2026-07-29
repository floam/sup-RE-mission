# Running and deploying the recovered claim app

## Status

The reconstruction is a runnable client-first Next.js application with a small server
compatibility layer. It includes Reown/Wagmi wallet connection, eligibility review,
projected SUP flow display, nonce-bounded event explanations, capped-campaign UX, Base
claim submission, and the recovered feature routes.

## Local use

```sh
cd research/claim-app-sources/reconstructed
npm ci
npm run dev
```

Production: `npm run build && npm start`. Vercel can deploy this directory as project
root. `package-lock.json` is the dependency authority.

## Contract and service stack

The runnable claim path uses:

- `@sfpro/sdk/abi/sup` for locker, locker-factory, and program-manager ABIs/addresses;
- Wagmi core `readContract` for locker, flow, pool, and nonce reads;
- Wagmi hooks for chain switching and `useWriteContract`;
- `waitForTransactionReceipt` for confirmation and explicit success checking;
- `lib/cms-client.ts` as the sole CMS transport boundary;
- `lib/claim-nonce-window.ts` for signed-snapshot interval derivation;
- a narrow local GDA pool ABI because `@sfpro/sdk` 0.2.3 does not export the pool ABI.

Do not duplicate SDK ABIs or construct CMS `/points/*` URLs outside the generated-client
boundary.

## Data paths

| Behavior | Data source |
| --- | --- |
| Campaign enumeration | SUP Goldsky subgraph |
| Campaign attribution | Recovered app definitions / public claim metadata |
| Raw and capped claim state | `POST /points/balance-batch` |
| Locker, units, and member flow | SDK ABIs through Wagmi |
| Pool totals | Narrow GDA pool reads through Wagmi |
| Last applied signed snapshot | `programManager.getNextValidNonce(programId, account) - 1` |
| Fresh upper snapshot | `POST /points/signed-balance-batch` `signatureTimestamp` |
| Pending event explanation | `POST /api/pending-claim-events` plus bounded `/points/events` |
| Voucher creation for submission | `POST /points/signed-balance-batch` |
| Transaction | SDK `lockerAbi`, Wagmi, Base, user's locker |

Claim-state batches require matching account, exact campaign order, and equal parallel
array lengths. The contract receives only signed/capped `points`; raw
`uncappedPoints` are explanatory data.

## SUP flow projection

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

The UI uses `2,628,000` seconds per average month. Projection is an estimate because
pool flow or other members' units can change before execution.

## Pending claim explanation route

```http
POST /api/pending-claim-events
Content-Type: application/json

{
  "account": "0x...",
  "campaignIds": [502, 607, 608]
}
```

The route:

1. validates unique positive campaign IDs and intersects them with active SUP programs;
2. resolves the wallet's locker once;
3. chunks fresh `signed-balance-batch` requests at 50 campaigns and validates them;
4. reads onchain units and `getNextValidNonce` for each campaign;
5. derives `lastClaimNonce = nextValidNonce - 1` and uses the signed response timestamp
   as `currentNonce`;
6. classifies capped campaigns before event retrieval;
7. skips synchronized and capped campaigns;
8. requests CMS events within the inclusive nonce-derived time interval and consumes
   them newest-first until their signed sum equals `uncappedPoints - onchainUnits`;
9. returns `matched` or explicit `partial` status plus nonce/window metadata.

A nonce is the timestamp of a signed balance snapshot. It is not the transaction's
block timestamp. A task needing the actual claim transaction must locate/decode the
transaction and verify its successful receipt or SDK-defined logs.

Boundary-second events are retained because nonces have second resolution; arithmetic
reconciliation determines whether the selected prefix needs them. CMS `createdAt` is
`eventTime`, so a later backfill with an older event time can still fall outside the
window.

## Capped campaigns

The unsigned state exposes raw `points` and claimable `cappedPoints`; signed responses
expose the same domains as `uncappedPoints` and `points`. When those values differ, the
UI displays `Capped out`, keeps the state visible after synchronization, and does not
load incremental events because further activity cannot increase the claim target.
A pending capped target is still submitted normally.

## Client batching and cache

The first explanation request sends all changed uncapped campaigns together. The
server resolves wallet-level state once and reconciles campaign event histories
concurrently. The client caches each result by account, campaign, onchain units, and
uncapped balance; a claim-state refresh naturally changes the key.

## Functional scope

- `/claim` connects or inspects a wallet, shows flows and capped states, explains
  uncapped deltas, and submits claims only for the owning connected wallet.
- `/apps`, `/governance`, `/leaderboard`, `/liquidity`, `/reserve`, `/reserve-names`,
  `/staking`, and `/swap` retain their reconstructed implementations.

## Verification

```sh
npm test
npm run test:e2e
npm run build
```

Also exercise `/claim` and a valid batched `POST /api/pending-claim-events` request.

## Known limitations

- Public subgraphs, RPC, and CMS availability remain runtime dependencies.
- Event ordering is by event time; insertion-time backfills are not observable.
- Same-second event order cannot be proven from second-resolution nonces alone.
- Multiple newest-first prefixes can share a net value; the algorithm chooses the first.
- A fresh signed-balance request creates a valid read-only voucher that the explanation
  route discards after using its typed balance values and nonce.
- Flow projections can move before execution.
- Claim-and-stake, disconnect-finished-pools, and future clear-macro variants remain
  outside this UI PR.
- This is a behavioral reconstruction, not the original private source tree.
