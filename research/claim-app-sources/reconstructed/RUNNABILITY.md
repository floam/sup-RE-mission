# Running and deploying the recovered claim app

## Status

The reconstruction is a runnable client-first Next.js application with a small server
compatibility layer for recovered features. The claim path itself uses Reown/Wagmi in
the browser for eligibility review, projected SUP flows, nonce-bounded event
explanations, capped-campaign UX, and Base claim submission.

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
- `client/program-attribution.ts` for live claim-app names, seasons, and categories;
- `client/pending-event-explanations.ts` for client-side explanation orchestration;
- `lib/claim-nonce-window.ts` for signed-snapshot interval derivation;
- a narrow local GDA pool ABI because `@sfpro/sdk` 0.2.3 does not export the pool ABI.

Do not duplicate SDK ABIs or construct CMS `/points/*` URLs outside the generated-client
boundary.

## Data paths

| Behavior                        | Data source                                                |
| ------------------------------- | ---------------------------------------------------------- |
| Campaign enumeration            | SUP Goldsky subgraph                                       |
| Campaign attribution            | Live claim `/api/programs`; recovered labels as fallback   |
| Raw and capped claim state      | `POST /points/balance-batch`                               |
| Locker, units, and member flow  | SDK ABIs through Wagmi                                     |
| Pool totals                     | Narrow GDA pool reads through Wagmi                        |
| Last applied signed snapshot    | `programManager.getNextValidNonce(programId, account) - 1` |
| Fresh upper snapshot            | `POST /points/signed-balance-batch` `signatureTimestamp`   |
| Pending event explanation       | Client helper plus bounded `GET /points/events` calls      |
| Voucher creation for submission | `POST /points/signed-balance-batch`                        |
| Transaction                     | SDK `lockerAbi`, Wagmi, Base, user's locker                |

Claim-state and signed-balance batches require matching account, exact campaign order,
and equal parallel array lengths. The contract receives only signed/capped `points`;
raw `uncappedPoints` are explanatory data.

## SUP flow projection

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

The UI uses `2,628,000` seconds per average month. Projection is an estimate because
pool flow or other members' units can change before execution.

## Pending claim explanations

`ClaimExperience` already has reviewed `PointState` rows containing the CMS raw and
claimable values plus current onchain units. When a user opens one uncapped changed
campaign, it passes the complete changed uncapped set to
`client/pending-event-explanations.ts`.

The helper:

1. chunks fresh `signed-balance-batch` requests at 50 campaigns and validates them;
2. rejects the explanation if fresh raw or claimable values no longer match the
   reviewed rows;
3. reads `getNextValidNonce` for each row, without repeating locker or unit reads;
4. derives `lastClaimNonce = nextValidNonce - 1` and uses the fresh signed response
   timestamp as `currentNonce`;
5. requests CMS events within the inclusive nonce-derived event-time interval;
6. consumes events newest-first until their signed sum equals
   `uncappedPoints - onchainUnits`;
7. returns the selected events or an explicit partial-explanation message.

The claim UI excludes synchronized and capped campaigns before calling the helper. A
nonce is the timestamp of a signed balance snapshot, not the transaction's block
timestamp. A task needing the actual claim transaction must locate/decode the
transaction and verify its successful receipt or SDK-defined logs.

Boundary-second events are retained because nonces have second resolution; arithmetic
reconciliation determines whether the selected prefix needs them. CMS `createdAt` is
`eventTime`, so a later backfill with an older event time can still fall outside the
window.

No local pending-event API route remains. The removed route repeated active-program,
locker, unit, signed-balance, and nonce work already available in the browser and had no
private credential, durable cache, authentication, or server-only authority.

## Capped campaigns

The unsigned state exposes raw `points` and claimable `cappedPoints`; signed responses
expose the same domains as `uncappedPoints` and `points`. When those values differ, the
UI displays `Capped out`, keeps the state visible after synchronization, and does not
load incremental events because further activity cannot increase the claim target.
A pending capped target is still submitted normally.

## Client batching and cache

The first explanation action processes all changed uncapped campaigns together. Signed
balances are batched, independent nonce/event work runs concurrently, and each result is
cached by account, campaign, onchain units, and uncapped balance. A claim-state refresh
naturally changes the key.

## Functional scope

- `/claim` connects or inspects a wallet, shows flows and capped states, explains
  uncapped deltas, and submits claims only for the owning connected wallet. Each
  changed campaign has a checkbox. Positive target deltas are checked by default;
  decreasing targets are clear. The controls lock during submission, the CMS signed
  batch contains only checked campaigns, and post-claim refreshes preserve explicit
  exclusions. A receipt transport error after submission remains indeterminate. Stale
  or uncertain state disables another submission and exposes a read-only refresh.
- `/apps`, `/governance`, `/leaderboard`, `/liquidity`, `/reserve`, `/reserve-names`,
  `/staking`, and `/swap` retain their reconstructed implementations.

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Also exercise `/claim`, open more than one changed campaign explanation to confirm cache
reuse, and confirm capped campaigns never request incremental events.

## Known limitations

- Public subgraphs, RPC, CMS, and claim-program metadata remain runtime dependencies.
- Event ordering is by event time; insertion-time backfills are not observable.
- Same-second event order cannot be proven from second-resolution nonces alone.
- Multiple newest-first prefixes can share a net value; the algorithm chooses the first.
- A fresh signed-balance request creates a valid read-only voucher; the helper discards
  its signature and uses only typed balance values and nonce.
- Flow projections can move before execution.
- Claim-and-stake, disconnect-finished-pools, and future clear-macro variants remain
  outside this UI PR.
- This is a behavioral reconstruction, not the original private source tree.
