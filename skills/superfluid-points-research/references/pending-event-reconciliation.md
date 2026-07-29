# Pending-event reconciliation

This file defines the runnable claim UI's explanation algorithm for
`POST /api/pending-claim-events`.

The route explains the difference between the current uncapped CMS balance and the
units already applied onchain. It uses claim nonces to bound the relevant CMS event
window, then applies newest-first lazy summation inside that window.

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

For each requested campaign:

```text
lastClaimNonce = getNextValidNonce(programId, account) - 1
currentNonce   = signed-balance-batch.signatureTimestamp
```

The prior nonce is the timestamp of the balance snapshot last applied onchain, not the
block timestamp at which its transaction was mined. This is the useful boundary: events
processed after that signed snapshot were not included in the claimed target even when
the transaction confirmed later.

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

For an active, existing, uncapped campaign whose onchain units differ from the CMS
balance:

1. Compute `targetDelta = uncappedPoints - onchainUnits`.
2. Read the last claimed nonce from `getNextValidNonce(...) - 1`.
3. Fetch a fresh signed balance and use its `signatureTimestamp` as the upper nonce.
4. Request `/points/events` inside that nonce-derived time window. Results are newest
   first by `eventTime`.
5. Consume events in returned order and add each signed `points` value, including
   negative adjustments.
6. Stop immediately when the accumulated sum equals `targetDelta`.
7. Return only that newest ordered prefix.
8. If the bounded pages are exhausted without equality, return the consumed events with
   `partial` status and the explained/target totals.

The arithmetic still chooses the first newest-first prefix that reaches the target. The
nonce interval prevents it from wandering into events older than the last balance
snapshot applied onchain.

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

## Batched local endpoint

The claim UI sends the whole changed uncapped campaign set once:

```http
POST /api/pending-claim-events
Content-Type: application/json

{
  "account": "0x...",
  "campaignIds": [502, 607, 608]
}
```

The route:

1. validates unique positive campaign IDs and requires every ID to be an active SUP
   program;
2. resolves the wallet's locker once;
3. chunks `/points/signed-balance-batch` calls at 50 IDs and validates account, order,
   and parallel arrays;
4. reads current onchain units and `getNextValidNonce` for each meaningful campaign;
5. derives the lower and upper nonce boundaries;
6. skips event retrieval for synchronized or capped campaigns;
7. reconciles meaningful uncapped differences concurrently;
8. returns one result per requested campaign, including both nonce boundaries.

The browser caches every returned explanation by account, campaign, onchain units, and
uncapped balance. A claim-state refresh changes the cache key.

## Safety bounds and limitations

- The local request accepts at most 250 campaign IDs.
- Signed CMS balance calls are internally chunked at 50 IDs.
- Event pages contain at most 100 records and retain an explicit page safety limit.
- Point values, nonces, and accumulated totals must remain JavaScript safe integers at
  the HTTP boundary; onchain values are checked before conversion.
- A fresh signed-balance request is read-only but produces an otherwise valid voucher;
  the explanation route discards its signature and uses only the typed balance values
  and nonce.
- CMS `createdAt` is event time rather than insertion time. A later backfill can carry
  a time outside the nonce window even though it changes the current balance; that case
  must report partial reconciliation.
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
