# Claim runtime endpoint inventory

This file is the operational inventory for the runnable reconstruction under
`research/claim-app-sources/reconstructed/`. It complements `endpoints.md`, which
contains the longer response-shape and error catalog for public points APIs.

Keep this file synchronized with:

- `research/claim-app-sources/reconstructed/lib/endpoints.ts`
- `research/claim-app-sources/reconstructed/lib/cms-client.ts`
- `research/claim-app-sources/reconstructed/client/claim-chain.ts`
- `research/claim-app-sources/reconstructed/client/claim-batch.ts`
- `research/claim-app-sources/reconstructed/app/api/pending-claim-events/route.ts`
- `research/claim-app-sources/reconstructed/server-actions/stats.ts`

## Runnable reconstruction routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/pending-claim-events?account=<address>&campaignId=<id>` | Explains the pending campaign update only when a previous claim can be transaction-confirmed. Resolves the locker and pool, indexes locker claims through the SUP subgraph, verifies the SDK claim event through Wagmi RPC, then asks `cmsClient` for events dated after that boundary. |
| `GET` | `/api/pending-claim-events?account=<address>&campaignId=<id>&debug=1` | Same response plus confirmation count and confirmed/indexed claim-event records. Use only for investigation; do not expose debug data as product copy. |

`/api/pending-claim-events` returns:

```json
{
  "account": "0x...",
  "campaignId": 608,
  "lockerAddress": "0x...",
  "poolAddress": "0x...",
  "boundaryStatus": "confirmed-claim",
  "lastClaimAt": "2026-07-01T12:34:56.000Z",
  "lastIndexedClaimAt": "2026-07-01T12:34:56.000Z",
  "events": []
}
```

`boundaryStatus` is one of:

- `confirmed-claim`: the SUP subgraph indexed a locker claim containing the campaign,
  and an SDK-defined `FluidStreamClaimed` or `FluidStreamsClaimed` log with the same
  transaction hash was verified through Wagmi RPC at the indexed block;
- `indexed-claim-unverified`: the subgraph contains a candidate claim, but RPC could
  not verify the corresponding SDK event;
- `no-claim`: no indexed locker claim containing the campaign was found within the
  bounded result set;
- `no-locker`: the account has no Reserve/locker.

Only `confirmed-claim` permits CMS event retrieval. Every other status returns
`events: []`, so the claim surface never silently substitutes full campaign history.
The route inspects at most 1,000 indexed locker claim events and verifies at most 25
campaign-matching candidates per request.

## Public claim-app-local routes

These paths are defined in the reconstructed `API_ENDPOINTS` table and refer to the
public `claim.superfluid.org` deployment when used there.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/programs` | Human-readable program/app attribution and claim-app onchain metadata. |
| `GET` | `/api/points/states?accountAddress=<address>` | Claimability rows: signed/capped target units versus current onchain units. |
| `GET` | `/api/points/claim?accountAddress=<address>` | Optional transaction payload/debug route for observed claim variants. |
| `GET` | `/api/mystery-box/check?address=<address>` | Daily mystery-box status. |
| `POST` | `/api/mystery-box/claim` | Record/complete a mystery-box claim after the transaction. |
| `GET` | `/api/bonus-flows/check?address=<address>` | Bonus-flow eligibility/status. |
| `POST` | `/api/bonus-flows/claim` | Claim bonus-flow points and SUP/month result. |
| `GET` | `/api/delegates` | Delegate list; inspect `X-Delegates-Source` for live versus snapshot data. |
| `GET` | `/api/delegates/amount?address=<address>` | Delegated amount for one address. |
| `GET` | `/api/leaderboard?page=<page>&limit=<limit>` | Paginated overall claim-app leaderboard. |
| `GET` | `/api/leaderboard/search?address=<address>` | Overall leaderboard lookup for one account. |

The legacy `getProgramApps` Next.js server action is invoked with:

```text
POST https://claim.superfluid.org/
next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f
content-type: text/plain;charset=UTF-8
accept: text/x-component
body: []
```

The action ID is deployment-specific and may rotate.

## CMS OpenAPI client boundary

The runnable claim path uses
`research/claim-app-sources/reconstructed/lib/cms-client.ts` as its sole CMS HTTP
boundary. Claim components, chain-state helpers, and reconstruction API routes must
not construct CMS URLs directly.

generated `openapi-fetch` client exposes:

| Method | CMS operation |
| --- | --- |
| `getBalance` | `GET /points/balance` |
| `getBalances` | `POST /points/balance-batch` |
| `getSignedBalances` | `POST /points/signed-balance-batch` |
| `getEventsPage` | `GET /points/events` |
| `getEventsSince` | Paginated `GET /points/events`, strictly after a verified event-time boundary |

The installed `@sfpro/sdk` 0.2.3 package supplies contract ABIs, Wagmi hooks, and
Wagmi actions. It does not export a CMS HTTP client. generated `openapi-fetch` client is repository-authored
against the CMS public OpenAPI contract and must not be described as an
`@sfpro/sdk` export.

The current response shapes are pinned to `superfluid-org/superfluid.pro` commit
`a79f0cd7969fbd96f97c7451079a538d8fc7202c`. Before using a balance or signed-balance
batch, validate:

1. response `address` equals the requested account;
2. `campaignIds` exactly preserve request order;
3. every parallel points array has the same length as `campaignIds`.

## CMS points API

Base: `https://cms.superfluid.pro`

| Method | Path | Purpose / limits |
| --- | --- | --- |
| `GET` | `/points/campaign?campaignId=<id>` | Resolve CMS campaign metadata. CMS absence does not disprove an onchain SUP program. |
| `GET` | `/points/events?campaignId=<id>&account=<address>&eventName=<name>&startTime=<time>&endTime=<time>&limit=<1..100>&page=<n>` | Paginated event enumeration. `startTime` and `endTime` filter `eventTime`; responses expose that value as `createdAt` for Stack compatibility. |
| `GET` | `/points/balance?campaignId=<id>&account=<address>` | One account in one campaign. |
| `POST` | `/points/balance` | Up to 100 accounts for one campaign. |
| `POST` | `/points/balance-batch` | One account across up to 50 campaigns. Preferred for active claim-state assembly and ID existence scans. |
| `GET` | `/points/event-balance?campaignId=<id>&eventName=<name>&account=<address>` | Aggregate one event type, optionally for one account. |
| `GET` | `/points/accounts?campaignId=<id>&orderBy=<field>&order=<asc|desc>&limit=<1..100>&page=<n>` | Campaign leaderboard/account aggregates. |
| `GET` | `/points/signed-balance?campaignId=<id>&account=<address>` | Signed single-program target units. |
| `POST` | `/points/signed-balance-batch` | Signed target units for up to 50 campaigns; use returned `points`, never diagnostic `uncappedPoints`, for `FluidLocker.claim`. |
| `POST` | `/points/push` | Authenticated point-event ingestion; accepts one event or up to 1000 events and returns `202 Accepted`. |

Claim-state procedure:

1. Enumerate programs from the SUP subgraph and retain only active programs for claim comparison.
2. Request capped targets with `cmsClient.POST("/points/balance-batch", …)` in chunks of 50.
3. Validate account, campaign order, and parallel array lengths before mapping values.
4. Resolve the locker with `lockerFactoryAddress` and `lockerFactoryAbi` from
   `@sfpro/sdk/abi/sup` through Wagmi `readContract`.
5. Read each program with SDK `lockerAbi` functions `getUnitsPerProgram` and
   `getFlowRatePerProgram`.
6. Read pool `getTotalUnits` and `getTotalFlowRate` through the narrow local GDA
   interface because `@sfpro/sdk` does not export the pool ABI.
7. Request vouchers with `cmsClient.POST("/points/signed-balance-batch", …)` and repeat the response validation.
8. Submit selected campaigns through SDK `lockerAbi` and Wagmi `useWriteContract`.
9. Wait with `waitForTransactionReceipt` and require `status: success`; refresh state
   after any confirmed partial batch if a later batch fails.

Projected member flow, assuming the pool total flow is unchanged at execution:

```text
projectedTotalUnits = poolTotalUnits - currentMemberUnits + targetMemberUnits
projectedFlowRate = poolTotalFlowRate * targetMemberUnits / projectedTotalUnits
```

Show this as an estimate in `SUP/month`; another member update or a funding-flow
change before inclusion can change the final rate.

## SUP claim-event index

Base: the SUP production subgraph listed below.

The pending-claim route queries:

```graphql
query LockerClaims($locker: Bytes!) {
  fluidStreamClaimEvents(
    first: 1000
    orderBy: blockTimestamp
    orderDirection: desc
    where: { locker: $locker }
  ) {
    id
    blockNumber
    blockTimestamp
    transactionHash
    units(first: 1000) {
      programId
    }
  }
}
```

Candidate events are filtered by campaign ID, then verified at the exact indexed block
through Wagmi `publicClient.getLogs` using `lockerAbi` from `@sfpro/sdk/abi/sup`.
The indexed and RPC transaction hashes must match.

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

This remains useful for optional token-ledger investigations. It is **not** used as the
claim-history index. A known locker/SUP query can return an empty or nearly empty
ledger even when locker claims exist, and GDA member-unit history must not be inferred
from that absence.

## Subgraphs and RPC

| Protocol | Endpoint |
| --- | --- |
| SUP production subgraph | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn` |
| SUP test subgraph | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn` |
| Base protocol subgraph | `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1` |
| Base Sepolia protocol subgraph | `https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1` |
| Uniswap V3 Base fallback | `https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest` |
| Base RPC | Alchemy URL assembled in `config/rpc.ts`; override with `NEXT_PUBLIC_ALCHEMY_API_KEY`. |

Use the SUP subgraph to enumerate `Program`, `Locker`, `FluidStreamClaimEvent`, and
`ClaimEventUnit` entities; use direct RPC to verify contract state and event logs; use
the protocol subgraph for indexed bulk GDA enrichment.

## Other public services used by the reconstruction

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `https://whois.superfluid.finance/api/resolve/<address>` | Address profile/identity resolution. |
| `GET` | `https://li.quest/v1/token?chain=8453&token=<address>` | Token price used by reconstructed liquidity statistics. |
| `POST` | `https://superfluid-eligibility-api.s.superfluid.dev/api/referrals/log-referral` | Logs `{ referralAddress, referralCode }` after a referred wallet creates a locker. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/total_delegated_score` | Governance delegated-score total. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/dao_members_count` | Governance member count. |
| `GET` | `https://sup-metrics-api.superfluid.dev/v1/distribution_metrics` | Public SUP distribution timeline/metrics endpoint used by research tooling and visualizations. |
| `GET` | `https://superfluid-airdrop.goodworker.workers.dev/?address=<address>` | Airdrop eligibility/status. |
| `GET` | `https://campaigns.superfluid.org/api/points/balance?account=<address>` | Campaigns-app-local account balance proxy; response shape still needs a committed capture. |
| `GET` | `https://campaigns.superfluid.org/api/markee/leaderboards` | Markee leaderboard route observed in the campaigns app. |
| `POST` | `https://gateway.thegraph.com/api/.../subgraphs/id/BpAX3z73agVd1qabngZrTj2etofZ9SgDdWz1yWyNoXtQ` | Campaigns-app Graph gateway; API-key-bearing URL and exact query must be captured from authorized traffic, not guessed. |

## Pending-claim event explanation

The claim surface provides an event-time-bounded explanation of the pending update.
Full campaign history belongs in a separate campaign explorer.

1. Resolve the locker and fetch newest SUP-subgraph `FluidStreamClaimEvent` rows.
2. Filter derived `ClaimEventUnit` rows to the requested campaign.
3. Verify the indexed transaction through SDK-defined locker claim logs using Wagmi.
4. If no claim can be verified, return no claim events and report `no-claim` or
   `indexed-claim-unverified`.
5. Call `getCmsEventsSince` with campaign, account, and verified `startTime`.
6. Remember that `startTime` filters CMS `eventTime`, which the response calls
   `createdAt`; a backfilled record with an earlier event time can be omitted even if
   inserted after the claim.
7. Fetch every page up to the explicit safety limit. Fail rather than silently truncate.
8. Group events by semantic family, stripping only a trailing opaque identifier,
   address, or transaction hash.
9. Render one compact row such as `3 × NFT mint = +30 pts`, with a date or date range
   beneath it.
10. Do not expand opaque IDs on the claim page. Preserve detailed event history for a
    separate explorer.
11. Reconcile the CMS event total with signed target delta and projected flow, but do
    not imply raw CMS points always equal onchain unit delta; caps, corrections,
    backfills, and campaign-specific processing may intervene.
