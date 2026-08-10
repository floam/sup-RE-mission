# Pending-event reconciliation

This file defines the runnable claim UI's client-side explanation algorithm.

The helper explains the difference between the current uncapped CMS balance and the
units already applied onchain. It reuses reviewed claim state, uses claim nonces to
bound the relevant CMS event window, then applies newest-first lazy summation inside
that window.

## Value domains

The CMS signed balance endpoints expose:

- `uncappedPoints`: the true accumulated point balance;
- `points`: the claimable target after the per-account cap;
- `signatureTimestamp`: the monotonic timestamp nonce signed with that balance.

The contract receives signed `points`, not `uncappedPoints`. The unsigned balance
endpoints expose the same two point domains as `points` and `cappedPoints`.

The runnable claim state records:

```text
uncappedPoints = CMS true balance
claim target   = CMS capped/signed points
onchain units  = FluidLocker.getUnitsPerProgram(programId)
```

A campaign is capped when `uncappedPoints !== claim target`.

## Nonce-bounded event window

`EPProgramManager` stores the last successful signed nonce in
`_lastValidNonces[programId][user]`. Its public `getNextValidNonce(programId, user)`
returns that stored nonce plus one.

For each explained campaign:

```text
lastClaimNonce = getNextValidNonce(programId, account) - 1
currentNonce   = signed-balance-batch.signatureTimestamp
```

The prior nonce is the timestamp of the balance snapshot last applied onchain, not the
block timestamp at which its transaction was mined. Events processed after that signed
snapshot were not included in the applied target even when the transaction confirmed
later.

The fresh signed-balance nonce is the upper snapshot boundary. Request CMS events with:

```text
startTime = lastClaimNonce, when a prior claim exists
endTime   = currentNonce
```

CMS filters by `eventTime`, exposed as `createdAt`. Nonces have second resolution, so
local filtering keeps events exactly on either boundary second and lets exact delta
reconciliation determine whether they are needed.

This eliminates SUP-subgraph claim discovery and transaction log/receipt verification
from the runnable explanation path. Receipt verification remains relevant only when a
research task needs the actual historical claim transaction or mined timestamp.

## Uncapped explanation algorithm

For an existing, uncapped campaign whose reviewed onchain units differ from the CMS
balance:

1. Compute `targetDelta = uncappedPoints - onchainUnits` from the reviewed row.
2. Fetch a fresh signed balance and reject the explanation if its raw or claimable value
   differs from the reviewed row.
3. Read the last claimed nonce from `getNextValidNonce(...) - 1`.
4. Use the fresh signed balance's `signatureTimestamp` as the upper nonce.
5. Request `/points/events` inside that nonce-derived time window. Results are newest
   first by `eventTime`.
6. Consume events in returned order and add each signed `points` value, including
   negative adjustments.
7. Stop immediately when the accumulated sum equals `targetDelta`.
8. Return only that newest ordered prefix.
9. If bounded pages are exhausted without equality, return the consumed events with an
   explicit partial-explanation message.

The UI can show an event count multiplier only when the semantic family and signed
point amount are equal. Events in one family with different point amounts stay on
separate lines.

The nonce interval prevents the arithmetic from wandering into events older than the
last balance snapshot applied onchain.

## Capped campaigns

When the CMS response has different raw and claimable values:

- render `Capped out` as a first-class campaign state;
- show the raw point balance and capped claim target under clear explanatory copy;
- state that additional activity will not increase the campaign's SUP stream;
- do not request or display incremental point events;
- keep the capped state visible after the onchain target is synchronized;
- if the capped target is not yet onchain, still include the campaign in the normal
  claim transaction.

Do not infer a cap from a local threshold. The CMS raw/claimable value pair is the
source of truth.

## Batched client helper

`ClaimExperience` filters the reviewed state to changed uncapped campaigns and calls
`client/pending-event-explanations.ts` once with the complete set.

The helper:

1. chunks `/points/signed-balance-batch` calls at 50 rows and validates account, order,
   and parallel arrays;
2. verifies the fresh raw and claimable values still equal each reviewed row;
3. reads only `getNextValidNonce` onchain, reusing each row's current units;
4. derives the lower and upper nonce boundaries;
5. reconciles independent campaign histories concurrently;
6. returns one `EventBreakdown` per row.

The browser caches every returned explanation by account, campaign, onchain units, and
uncapped balance until the explanation or reviewed claim state is cleared.

Campaign transaction selection does not change this explanation set. Each changed
campaign has a checkbox. Positive target deltas are selected by default; decreasing
targets are clear. A submission locks that displayed selection, requests a signed batch
only for checked campaigns, and preserves explicit exclusions across refreshed state.
An indeterminate receipt wait or failed post-claim refresh clears and locks the stale
selection until a read-only refresh succeeds.

No local API endpoint remains. The deleted route repeated public program, locker, unit,
CMS, and nonce work and supplied no private credential, authentication, durable shared
cache, or server-only authority.

## Safety bounds and limitations

- Signed CMS balance calls are chunked at 50 campaigns.
- Event pages contain at most 100 records and retain an explicit page safety limit.
- Point values, nonces, and accumulated totals must remain JavaScript safe integers at
  conversion boundaries.
- A fresh signed-balance request is read-only but produces an otherwise valid voucher;
  the helper discards its signature and uses only typed balance values and nonce.
- CMS `createdAt` is event time rather than insertion time. A later backfill can carry
  a time outside the nonce window even though it changes the current balance; that case
  produces a partial explanation.
- Several event prefixes can share the same net value. The algorithm deliberately uses
  the first newest-first prefix that reaches the target.
- Same-second event ordering cannot be proven from a second-resolution nonce alone.
  Boundary-second events are included and arithmetic reconciliation decides whether the
  selected prefix needs them.

## Historical transaction research

When a task requires the actual claim transaction, mined timestamp, caller, or calldata,
use the nonce and claim-history tools. Discover locker claims, decode transaction input,
and verify the receipt or SDK-defined logs on Base. Do not describe the nonce snapshot
time as the transaction's block time.
