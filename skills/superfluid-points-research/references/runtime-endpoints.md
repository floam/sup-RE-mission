# Claim runtime endpoint inventory

Operational inventory for `research/claim-app-sources/reconstructed/`. The longer
public response/error catalog remains in `references/endpoints.md`.

Keep synchronized with `lib/cms-client.ts`, `lib/cms-events.ts`,
`lib/claim-nonce-window.ts`, `client/claim-chain.ts`, `client/claim-batch.ts`, and
`app/api/pending-claim-events/route.ts`.

## Runnable reconstruction routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/pending-claim-events` | Batch explanation for changed campaigns. Resolves one locker, fetches fresh signed balances, reads onchain units and next valid nonces, skips capped/synchronized campaigns, and lazily reconciles bounded CMS events. |

Request:

```json
{
  "account": "0x...",
  "campaignIds": [502, 607, 608]
}
```

Response shape:

```json
{
  "account": "0x...",
  "lockerAddress": "0x...",
  "results": [
    {
      "campaignId": 608,
      "reconciliationStatus": "matched",
      "onchainPoints": 100,
      "uncappedPoints": 130,
      "claimablePoints": 130,
      "targetPoints": 30,
      "explainedPoints": 30,
      "lastClaimNonce": 1780000000,
      "currentNonce": 1780000100,
      "windowStart": "2026-05-28T20:26:40.000Z",
      "windowEnd": "2026-05-28T20:28:20.000Z",
      "events": []
    }
  ]
}
```

`reconciliationStatus` is `matched`, `partial`, `capped`, or `no-change`.

The route accepts at most 250 unique positive campaign IDs, requires all requested IDs
to be active SUP programs, chunks signed CMS requests at 50 IDs, and retains an
explicit event-page safety limit.

## Public claim-app-local routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/programs` | Program/app attribution and claim-app metadata. |
| `GET` | `/api/points/states?accountAddress=<address>` | Signed/capped target units versus current units. |
| `GET` | `/api/points/claim?accountAddress=<address>` | Optional transaction payload/debug route. |
| `GET` | `/api/mystery-box/check?address=<address>` | Daily mystery-box status. |
| `POST` | `/api/mystery-box/claim` | Complete a mystery-box claim. |
| `GET` | `/api/bonus-flows/check?address=<address>` | Bonus-flow status. |
| `POST` | `/api/bonus-flows/claim` | Claim bonus-flow points. |
| `GET` | `/api/delegates` | Delegate list. |
| `GET` | `/api/delegates/amount?address=<address>` | Delegated amount. |
| `GET` | `/api/leaderboard?page=<page>&limit=<limit>` | Overall leaderboard. |
| `GET` | `/api/leaderboard/search?address=<address>` | Overall leaderboard account lookup. |

The observed legacy `getProgramApps` Next action uses deployment-specific action ID
`0050c3f0d604f9162ceb3faa2d83005031b4be6b5f`; it may rotate.

## CMS generated client boundary

Base: `https://cms.superfluid.pro`

Application code calls generated paths through `lib/cms-client.ts`:

| Method | Path | Use |
| --- | --- | --- |
| `GET` | `/points/campaign` | Campaign metadata. |
| `GET` | `/points/balance` | One unsigned raw/capped balance. |
| `POST` | `/points/balance` | Multiple accounts for one campaign. |
| `POST` | `/points/balance-batch` | Claim-state raw/capped balances, up to 50 campaigns. |
| `GET` | `/points/events` | Account/campaign events, optional event name and time bounds, pages up to 100. |
| `GET` | `/points/event-balance` | Aggregate one event type. |
| `GET` | `/points/accounts` | Campaign account aggregates/leaderboard. |
| `GET` | `/points/signed-balance` | Signed one-campaign target. |
| `POST` | `/points/signed-balance-batch` | Signed targets and a shared timestamp nonce, up to 50 campaigns. |
| `POST` | `/points/push` | Authenticated event ingestion; server-side only. |

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

1. Resolve active programs and one locker.
2. Fetch fresh signed balances in validated chunks of 50.
3. Read current units and next valid nonce for each requested campaign.
4. Compute `targetDelta = uncappedPoints - onchainUnits`.
5. If raw and claimable values differ, return `capped` and fetch no events.
6. If the delta is zero, return `no-change`.
7. Otherwise query `/points/events` with account, campaign, inclusive `startTime` from
   last accepted nonce when nonzero, and inclusive `endTime` from the fresh signed nonce.
8. Consume newest-first signed event points until the first prefix equals the delta.
9. Return `matched`, or `partial` when bounded history is exhausted.
10. Group event names by semantic family in the UI.

CMS sorts by `eventTime`, exposed as `createdAt`. Boundary-second events remain because
nonce resolution is one second. A backfilled event can carry a time outside the window.

## Claim-state and transaction procedure

1. Enumerate active SUP programs.
2. Fetch unsigned raw/capped values through `balance-batch`.
3. Resolve locker through SDK factory ABI.
4. Read program units/member flow and pool total units/flow.
5. Project current and target `SUP/month`.
6. On explicit submission fetch `signed-balance-batch`, validate, and submit signed
   `points`, campaign IDs, timestamp, and signature through SDK `lockerAbi`.
7. Require receipt `status: success`; refresh state after partial multi-batch success.

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

| Source | Endpoint |
| --- | --- |
| SUP production subgraph | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn` |
| SUP test subgraph | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn` |
| Base protocol subgraph | `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1` |
| Base Sepolia protocol subgraph | `https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1` |
| Uniswap V3 Base fallback | `https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest` |
| Base RPC | Alchemy URL assembled in `config/rpc.ts`; override with `NEXT_PUBLIC_ALCHEMY_API_KEY`. |

Use the SUP subgraph for program/indexed history discovery, direct RPC for current
contract truth and transaction verification, and protocol subgraph for bulk GDA data.
The runnable pending-event explanation no longer needs SUP claim-event discovery.

## Other public services

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `https://whois.superfluid.finance/api/resolve/<address>` | Address identity. |
| `GET` | `https://li.quest/v1/token?chain=8453&token=<address>` | Token price. |
| `POST` | `https://superfluid-eligibility-api.s.superfluid.dev/api/referrals/log-referral` | Referral log. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/total_delegated_score` | Governance delegated total. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/dao_members_count` | Governance member count. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/distribution_metrics` | Distribution timeline/metrics. |
| `GET` | `https://superfluid-airdrop.goodworker.workers.dev/?address=<address>` | Airdrop status. |
| `GET` | `https://campaigns.superfluid.org/api/points/balance?account=<address>` | Campaigns-app balance proxy. |
| `GET` | `https://campaigns.superfluid.org/api/markee/leaderboards` | Markee leaderboard. |
