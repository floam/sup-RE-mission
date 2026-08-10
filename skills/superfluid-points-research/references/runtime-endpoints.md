# Claim runtime endpoint inventory

Operational inventory for `research/claim-app-sources/reconstructed/`. The longer
public response/error catalog remains in `references/endpoints.md`.

Keep synchronized with `lib/cms-client.ts`, `lib/cms-events.ts`,
`lib/claim-nonce-window.ts`, `client/claim-chain.ts`, `client/claim-batch.ts`,
`client/program-attribution.ts`, and `client/pending-event-explanations.ts`.

## Runnable reconstruction routes

The pending-event explanation is not an HTTP route. `ClaimExperience` calls
`client/pending-event-explanations.ts` directly with reviewed changed uncapped rows.
Recovered and compatibility application routes remain under `app/`; no
`/api/pending-claim-events` endpoint exists.

## Public claim-app-local routes

| Method | Route                                         | Purpose                                          |
| ------ | --------------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/programs`                               | Program/app attribution and claim-app metadata.  |
| `GET`  | `/api/points/states?accountAddress=<address>` | Signed/capped target units versus current units. |
| `GET`  | `/api/points/claim?accountAddress=<address>`  | Optional transaction payload/debug route.        |
| `GET`  | `/api/mystery-box/check?address=<address>`    | Daily mystery-box status.                        |
| `POST` | `/api/mystery-box/claim`                      | Complete a mystery-box claim.                    |
| `GET`  | `/api/bonus-flows/check?address=<address>`    | Bonus-flow status.                               |
| `POST` | `/api/bonus-flows/claim`                      | Claim bonus-flow points.                         |
| `GET`  | `/api/delegates`                              | Delegate list.                                   |
| `GET`  | `/api/delegates/amount?address=<address>`     | Delegated amount.                                |
| `GET`  | `/api/leaderboard?page=<page>&limit=<limit>`  | Overall leaderboard.                             |
| `GET`  | `/api/leaderboard/search?address=<address>`   | Overall leaderboard account lookup.              |

The observed legacy `getProgramApps` Next action uses deployment-specific action ID
`0050c3f0d604f9162ceb3faa2d83005031b4be6b5f`; it may rotate.

The runnable `/apps` and `/claim` pages fetch
`https://claim.superfluid.org/api/programs`, parse the top-level SuperJSON `json`
array, and let those live names, seasons, and categories replace recovered labels for
matching program IDs. Recovered definitions remain a display fallback only. Program
existence and lifecycle still come from the SUP subgraph; claim-app metadata is
attribution, not onchain authority.

## CMS generated client boundary

Base: `https://cms.superfluid.pro`

Application code calls generated paths through `lib/cms-client.ts`:

| Method | Path                           | Use                                                                            |
| ------ | ------------------------------ | ------------------------------------------------------------------------------ |
| `GET`  | `/points/campaign`             | Campaign metadata.                                                             |
| `GET`  | `/points/balance`              | One unsigned raw/capped balance.                                               |
| `POST` | `/points/balance`              | Multiple accounts for one campaign.                                            |
| `POST` | `/points/balance-batch`        | Claim-state raw/capped balances, up to 50 campaigns.                           |
| `GET`  | `/points/events`               | Account/campaign events, optional event name and time bounds, pages up to 100. |
| `GET`  | `/points/event-balance`        | Aggregate one event type.                                                      |
| `GET`  | `/points/accounts`             | Campaign account aggregates/leaderboard.                                       |
| `GET`  | `/points/signed-balance`       | Signed one-campaign target.                                                    |
| `POST` | `/points/signed-balance-batch` | Signed targets and a shared timestamp nonce, up to 50 campaigns.               |
| `POST` | `/points/push`                 | Authenticated event ingestion; server-side only.                               |

For batch responses, require matching account, exact campaign order, and equal parallel
array lengths.

Value domains:

- unsigned `points` = true accumulated/raw balance;
- unsigned `cappedPoints` = claimable target;
- signed `uncappedPoints` = raw balance;
- signed `points` = claimable target submitted to the contract;
- signed `signatureTimestamp` = voucher nonce and current snapshot boundary.

`@sfpro/sdk` 0.2.3 does not provide the CMS HTTP client.

## Program-manager nonce boundary

Import `programManagerAddress` and `programManagerAbi` from `@sfpro/sdk/abi/sup` and
read:

```text
getNextValidNonce(programId, account)
```

Contract semantics:

```text
lastClaimNonce = getNextValidNonce(programId, account) - 1
currentNonce   = signedBalance.signatureTimestamp
```

A successful claim stores its submitted nonce; next valid nonce is stored nonce plus
one. A nonce is valid only when greater than the stored value. The fresh signed nonce
must therefore be strictly greater than `lastClaimNonce`.

These are signed-balance snapshot timestamps. The lower bound is not the claim
transaction's mined timestamp. For transaction hash/block time/caller/calldata, inspect
and verify the actual transaction.

## Pending-event explanation procedure

1. Build reviewed claim state: active programs, locker, raw/claimable values, current
   units, and flow projection.
2. Filter to existing, changed, uncapped `PointState` rows.
3. Pass the complete set once to `client/pending-event-explanations.ts`.
4. Fetch fresh signed balances in validated chunks of 50 and reject value drift.
5. Read `getNextValidNonce` for each row; do not repeat locker or unit reads.
6. Compute `targetDelta = row.uncappedPoints - row.onchainPoints`.
7. Query `/points/events` with account, campaign, inclusive `startTime` from the last
   accepted nonce when nonzero, and inclusive `endTime` from the fresh signed nonce.
8. Consume newest-first signed event points until the first prefix equals the delta.
9. Return the selected events or an explicit partial-explanation message.
10. Group event names by semantic family and equal point amount in the UI. Cache each
    result against the reviewed row values.

CMS sorts by `eventTime`, exposed as `createdAt`. Boundary-second events remain because
nonce resolution is one second. A backfilled event can carry a time outside the window.

## Claim-state and transaction procedure

1. Enumerate active SUP programs.
2. Fetch unsigned raw/capped values through `balance-batch`.
3. Resolve locker through SDK factory ABI.
4. Read program units/member flow and pool total units/flow.
5. Project current and target `SUP/month`.
6. Show a selection control for each changed campaign. Select positive target deltas
   by default and leave decreasing targets clear.
7. On explicit submission fetch `signed-balance-batch` only for selected campaigns,
   validate it, and submit signed `points`, campaign IDs, timestamp, and signature
   through SDK `lockerAbi`.
8. Lock campaign selection during submission and preserve explicit exclusions across
   post-claim refreshes. Require receipt `status: success` before reporting confirmed
   success. A receipt wait transport error after submission is indeterminate, not a
   verified failure. Clear and lock stale selection after an uncertain confirmation or
   failed post-claim refresh, then allow only a read-only state refresh before retrying.

## Historical balance API

Base: `https://balances.superfluid.dev`

```text
GET /v1/accounts/{account}/tokens/{token}/entries
  ?chain=8453
  &counterparty={pool}
  &direction=desc
  &limit=100
  &offset=0
```

Use only for optional token-ledger investigation. Empty results do not disprove locker
claims or GDA unit history.

## Subgraphs and RPC

| Source                         | Endpoint                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| SUP production subgraph        | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn`          |
| SUP test subgraph              | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn` |
| Base protocol subgraph         | `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1`                                |
| Base Sepolia protocol subgraph | `https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1`                                |

Use the SUP subgraph for program and indexed claim research, direct Base RPC for current
contract truth, and the protocol subgraph for bulk GDA enrichment.
