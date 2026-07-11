# Superfluid points endpoint notes

This reference is for SPR/points campaign discovery, campaign metadata, point-event enumeration, claim-program lookup, and leaderboard-related routes. It separates the CMS-backed routes in this repository from routes observed in the deployed `claim.superfluid.org` and `campaigns.superfluid.org` bundles.

## Source classification

- **CMS-backed**: Implemented by `cms/src/app/(api)/points/*` in this repository and served by `https://cms.superfluid.pro` as `/points/*`.
- **campaigns-app-local**: Observed in the `campaigns.superfluid.org` bundle as `/api/*`; may proxy a CMS route or be implemented by that Next.js app.
- **claim-app-local**: Observed in the `claim.superfluid.org` bundle as `/api/*` or as a Next.js server action; implementation was not found in this repository.
- **external**: Third-party or separately deployed service used by a public app.

## CMS-backed points API

### Get campaign metadata

- **Method and URL**: `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "campaignId": 42,
  "name": "Example Campaign",
  "slug": "example-campaign",
  "totalPoints": 12345,
  "memberCount": 12,
  "totalEvents": 34,
  "lastEventAt": "2026-06-30T12:00:00.000Z",
  "createdAt": "2026-06-01T00:00:00.000Z"
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: campaignId" }
```

```json
{ "message": "campaignId must be a positive integer" }
```

```json
{ "message": "Campaign not found" }
```

- **Notes**:
  - Use this to resolve offchain CMS campaign metadata only after candidate IDs have been discovered.
  - Claim-app program IDs and CMS campaign IDs overlap but are not identical; a valid onchain claim program may return `Campaign not found` here.

### Get point events

- **Method and URL**: `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `account` (optional): Ethereum address. The handler validates it and lowercases it for lookup.
  - `eventName` (optional): exact point event name.
  - `startTime` (optional): ISO 8601 timestamp or Unix timestamp in seconds.
  - `endTime` (optional): ISO 8601 timestamp or Unix timestamp in seconds.
  - `limit` (optional): integer from 1 to 100. Default is 50.
  - `page` (optional): positive integer. Default is 1.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "events": [
    {
      "id": 123,
      "eventName": "example-event",
      "account": "0x0000000000000000000000000000000000000000",
      "points": 100,
      "uniqueId": "example-unique-id",
      "createdAt": "2026-06-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "totalDocs": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: campaignId" }
```

```json
{ "message": "Campaign not found" }
```

```json
{ "message": "limit must be between 1 and 100" }
```

```json
{ "error": "startTime must be before or equal to endTime" }
```

- **Notes**:
  - Use only for resolved CMS campaigns.
  - For point-event name reports, fetch all pages for active campaigns. For finished pre-Season-6 campaigns, sampling first and final pages can be sufficient for exploratory reports.

### Get single-account campaign balance

- **Method and URL**: `GET https://cms.superfluid.pro/points/balance?campaignId=<id>&account=<address>`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `account` (required): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "points": 100,
  "cappedPoints": 100
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: account" }
```

```json
{ "message": "Invalid Ethereum address" }
```

```json
{ "message": "Campaign not found" }
```

- **Notes**:
  - `campaigns.superfluid.org` was observed calling `/api/points/balance?account={address}` without `campaignId`; that app-local route appears to expose or proxy campaign-point account state for its UI and is not the same documented CMS query shape.

### Get multiple account balances for one campaign

- **Method and URL**: `POST https://cms.superfluid.pro/points/balance`
- **Classification**: CMS-backed.
- **Query parameters**: none.
- **Body parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `accounts` (required): non-empty array of up to 100 Ethereum addresses.
- **Minimal successful request body**:

```json
{
  "campaignId": 42,
  "accounts": ["0x0000000000000000000000000000000000000000"]
}
```

- **Minimal successful response example**:

```json
{
  "balances": [
    {
      "account": "0x0000000000000000000000000000000000000000",
      "points": 100,
      "cappedPoints": 100
    }
  ]
}
```

- **Missing/error response examples**:

```json
{ "message": "campaignId must be a positive integer" }
```

```json
{ "message": "accounts must be a non-empty array" }
```

```json
{
  "message": "Invalid Ethereum addresses",
  "invalid": ["not-an-address"]
}
```

- **Notes**:
  - Best for one known CMS campaign and a bounded account list.

### Batch balance / campaign existence check

- **Method and URL**: `POST https://cms.superfluid.pro/points/balance-batch`
- **Classification**: CMS-backed.
- **Query parameters**: none.
- **Body parameters**:
  - `account` (required): Ethereum address.
  - `campaignIds` (required): non-empty array of up to 50 positive integer campaign IDs.
- **Minimal successful request body**:

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611, 9999]
}
```

- **Minimal successful response example**:

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611, 9999],
  "points": [0, 0],
  "cappedPoints": [0, 0],
  "warnings": [
    { "campaignId": 9999, "message": "Campaign not found" }
  ]
}
```

- **Missing/error response examples**:

```json
{ "message": "campaignIds must be a non-empty array" }
```

```json
{ "message": "Maximum 50 campaigns allowed per request" }
```

```json
{
  "message": "Invalid campaign IDs (must be positive integers)",
  "invalid": [0, "abc"]
}
```

```json
{ "message": "Invalid Ethereum address" }
```

- **Notes**:
  - Use the zero address when checking campaign existence only.
  - Missing campaigns are non-fatal and are returned in `warnings`.
  - This is the preferred endpoint for scanning candidate ID ranges in chunks of 50; do not brute-force `GET /points/campaign` unless no batch route is available.


### Event-balance aggregate

- **Method and URL**: `GET https://cms.superfluid.pro/points/event-balance?campaignId=<id>&eventName=<eventName>`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `eventName` (required): point event name, at most 100 characters.
  - `account` (optional): Ethereum address. When present, aggregates only that account; otherwise aggregates all accounts.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "eventName": "example-event",
  "points": 100
}
```

With `account` supplied:

```json
{
  "eventName": "example-event",
  "points": 100,
  "account": "0x0000000000000000000000000000000000000000"
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: eventName" }
```

```json
{ "message": "eventName must be at most 100 characters" }
```

```json
{ "message": "Campaign not found" }
```

- **Notes**:
  - Useful when a report needs an aggregate for one event type rather than the paginated raw `/points/events` list.

### Campaign accounts / leaderboard

- **Method and URL**: `GET https://cms.superfluid.pro/points/accounts?campaignId=<id>&orderBy=totalPoints&order=desc&limit=50&page=1`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `orderBy` (optional): one of `totalPoints`, `eventCount`, `lastEventAt`. Default is `totalPoints`.
  - `order` (optional): `asc` or `desc`. Default is `desc`.
  - `limit` (optional): integer from 1 to 100. Default is 50.
  - `page` (optional): positive integer. Default is 1.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "accounts": [
    {
      "account": "0x0000000000000000000000000000000000000000",
      "totalPoints": 100,
      "eventCount": 2,
      "lastEventAt": "2026-06-30T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalDocs": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: campaignId" }
```

```json
{ "message": "orderBy must be one of: totalPoints, eventCount, lastEventAt" }
```

```json
{ "message": "Campaign not found" }
```

- **Notes**:
  - This is the CMS-backed leaderboard capability for a single campaign.


### Signed single-campaign balance

- **Method and URL**: `GET https://cms.superfluid.pro/points/signed-balance?campaignId=<id>&account=<address>`
- **Classification**: CMS-backed.
- **Query parameters**:
  - `campaignId` (required): positive integer campaign ID.
  - `account` (required): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**:

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "points": 100,
  "uncappedPoints": 100,
  "signatureTimestamp": 1782868800,
  "signature": "0x...",
  "signer": "0x0000000000000000000000000000000000000000"
}
```

- **Missing/error response examples**:

```json
{ "message": "Missing required query parameter: account" }
```

```json
{ "message": "Campaign not found" }
```

```json
{ "message": "Signing not available" }
```

- **Notes**:
  - Signs `address`, capped `points`, `campaignId`, and `signatureTimestamp` for single-program claim compatibility.

### Signed batch balance for claims

- **Method and URL**: `POST https://cms.superfluid.pro/points/signed-balance-batch`
- **Classification**: CMS-backed.
- **Query parameters**: none.
- **Body parameters**:
  - `account` (required): Ethereum address.
  - `campaignIds` (required): non-empty array of up to 50 positive integer campaign IDs.
- **Minimal successful request body**:

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611]
}
```

- **Minimal successful response example**:

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611],
  "points": [100],
  "uncappedPoints": [100],
  "signatureTimestamp": 1782868800,
  "signature": "0x...",
  "signer": "0x0000000000000000000000000000000000000000"
}
```

- **Missing/error response examples**:

```json
{
  "message": "One or more campaigns not found",
  "missing": [9999]
}
```

```json
{ "message": "Signing not available" }
```

- **Notes**:
  - Signs a single message over `address`, `points[]`, `campaignIds[]`, and `signatureTimestamp` for batch onchain claim flows.


### Push point events

- **Method and URL**: `POST https://cms.superfluid.pro/points/push`
- **Classification**: CMS-backed.
- **Authentication**: CMS points API key; the key is bound to one campaign.
- **Query parameters**: none.
- **Body parameters**:
  - Single event form: `campaignId` or deprecated `campaign` (optional, must match API-key campaign if present), `eventName`, `account`, `points`, optional `uniqueId`.
  - Batch with root defaults: optional `campaignId`/`campaign`, root `eventName`, optional root `uniqueId`, and `events` array of 1 to 1000 objects with `account` and integer `points`.
  - Batch with per-event values: optional `campaignId`/`campaign`, and `events` array of 1 to 1000 objects with `eventName`, `account`, integer `points`, and optional `uniqueId`.
- **Minimal successful request body**:

```json
{
  "eventName": "example-event",
  "account": "0x0000000000000000000000000000000000000000",
  "points": 100,
  "uniqueId": "example-unique-id"
}
```

- **Minimal successful response example**:

```json
{
  "message": "Push request accepted for processing",
  "pushRequestId": 123,
  "eventCount": 1
}
```

- **Missing/error response examples**:

```json
{
  "message": "Validation failed",
  "details": [
    { "path": "account", "message": "Invalid Ethereum address" }
  ]
}
```

```json
{ "message": "Provided campaign ID (1) does not match API key's campaign (2)" }
```

- **Notes**:
  - Returns `202 Accepted` immediately; processing is performed asynchronously by Trigger.dev.
  - Use `/points/events`, `/points/balance`, or `/points/accounts` to inspect processed results later.

## campaigns.superfluid.org app-local and external endpoints

### Campaigns app account points balance

- **Method and URL**: `GET https://campaigns.superfluid.org/api/points/balance?account=<address>`
- **Classification**: campaigns-app-local; observed bundle notes say it maps to or proxies CMS `GET /points/balance`, but the deployed app-local shape omits the CMS `campaignId` query parameter.
- **Query parameters**:
  - `account` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: reads an account's campaign points and prefers `cappedPoints` over `points` for UI/account state.

#### Unknown / needs capture

Capture a successful and failing response for:

```text
GET https://campaigns.superfluid.org/api/points/balance?account=0x0000000000000000000000000000000000000000
```

### Markee leaderboards

- **Method and URL**: `GET https://campaigns.superfluid.org/api/markee/leaderboards`
- **Classification**: campaigns-app-local.
- **Query parameters**: none observed.
- **Body parameters**: none observed.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Not SPR-specific, but present in the campaigns app bundle.

#### Unknown / needs capture

Capture a successful and failing response for:

```text
GET https://campaigns.superfluid.org/api/markee/leaderboards
```

### Whois profile resolver

- **Method and URL**: `GET https://whois.superfluid.finance/api/resolve/<address>`
- **Classification**: external.
- **Query/body parameters**: none; address is a path parameter.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Used by both public bundles to resolve Superfluid profile metadata for addresses.

#### Unknown / needs capture

Capture a successful and failing response for:

```text
GET https://whois.superfluid.finance/api/resolve/0x0000000000000000000000000000000000000000
```

### Campaigns app Graph gateway subgraph

- **Method and URL**: `POST https://gateway.thegraph.com/api/.../subgraphs/id/BpAX3z73agVd1qabngZrTj2etofZ9SgDdWz1yWyNoXtQ`
- **Classification**: external GraphQL endpoint.
- **Query parameters**: none known.
- **Body parameters**: GraphQL request body; exact query shape is unknown / needs capture.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - The audit recorded the subgraph ID and that the app posts to it, not a stable API-key-bearing URL or query document.

#### Unknown / needs capture

Capture the GraphQL operation and response for the campaigns app subgraph request.

## claim.superfluid.org app-local endpoints and server action

### Program app list server action

- **Method and URL**: `POST https://claim.superfluid.org/`
- **Classification**: claim-app-local Next.js server action.
- **Headers**:
  - `next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f` (observed July 2, 2026; may rotate with deployments).
  - `content-type: text/plain;charset=UTF-8`
  - `accept: text/x-component`
- **Query parameters**: none.
- **Body parameters**: React server action payload `[]`.
- **Minimal successful response example**:

```text
1:[{"program":{"id":611}}]
```

- **Missing/error response example**: Unknown / needs capture for stale or invalid `next-action` IDs.
- **Notes**:
  - Response is React Flight text. Parse the line prefixed with `1:` as JSON and extract IDs from `app.program?.id`.
  - Program IDs are onchain claim programs; report them separately from CMS campaign IDs.
  - If the action ID stops working, fetch `https://claim.superfluid.org`, download `/_next/static/...js` chunks, and search for `getProgramApps`, `createServerReference`, `programApps`, `/api/points/states`, or `/api/points/claim`.

#### Unknown / needs capture

Capture the error response for:

```text
POST https://claim.superfluid.org/
next-action: <stale-or-invalid-action-id>
body: []
```

### Claim state lookup

- **Method and URL**: `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `accountAddress` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: checks whether the connected account can claim program points before fetching the claim payload.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/points/states?accountAddress=0x0000000000000000000000000000000000000000
```

### Claim payload lookup

- **Method and URL**: `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `accountAddress` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: returns point-claim transaction data, including single/batch transaction type, program IDs, units, nonce, and Stack signature used for `claim`, `claimAndStake`, `disconnectAndClaim`, or batch variants.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/points/claim?accountAddress=0x0000000000000000000000000000000000000000
```

### Mystery-box check

- **Method and URL**: `GET https://claim.superfluid.org/api/mystery-box/check?address=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `address` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: checks daily mystery-box eligibility/status.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/mystery-box/check?address=0x0000000000000000000000000000000000000000
```

### Mystery-box claim

- **Method and URL**: `POST https://claim.superfluid.org/api/mystery-box/claim`
- **Classification**: claim-app-local.
- **Query parameters**: none.
- **Body parameters**:
  - `address` (observed): Ethereum address.
  - `transactionHash` (observed): transaction hash.
- **Minimal successful request body**:

```json
{
  "address": "0x0000000000000000000000000000000000000000",
  "transactionHash": "0x..."
}
```

- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: claims a mystery-box result after a transaction hash is available.

#### Unknown / needs capture

Capture successful and missing/error responses for `POST https://claim.superfluid.org/api/mystery-box/claim`.

### Bonus-flows check

- **Method and URL**: `GET https://claim.superfluid.org/api/bonus-flows/check?address=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `address` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: checks bonus-flow eligibility/status.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/bonus-flows/check?address=0x0000000000000000000000000000000000000000
```

### Bonus-flows claim

- **Method and URL**: `POST https://claim.superfluid.org/api/bonus-flows/claim`
- **Classification**: claim-app-local.
- **Query parameters**: none.
- **Body parameters**:
  - `address` (observed): Ethereum address.
- **Minimal successful request body**:

```json
{ "address": "0x0000000000000000000000000000000000000000" }
```

- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: claims bonus-flow points/SUP-per-month information.
  - Bundle notes observed response fields `points`, `supPerMonth`, and `isBigBonus`, but no full response shape is available here.

#### Unknown / needs capture

Capture successful and missing/error responses for `POST https://claim.superfluid.org/api/bonus-flows/claim`.

### Delegates list

- **Method and URL**: `GET https://claim.superfluid.org/api/delegates`
- **Classification**: claim-app-local.
- **Query parameters**: none observed.
- **Body parameters**: none observed.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: retrieves delegates.
  - Client warns if `X-Delegates-Source` is `snapshot`, implying a live source with local snapshot fallback.

#### Unknown / needs capture

Capture response headers and successful/missing/error bodies for:

```text
GET https://claim.superfluid.org/api/delegates
```

### Delegate amount lookup

- **Method and URL**: `GET https://claim.superfluid.org/api/delegates/amount?address=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `address` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: retrieves delegated amount for a delegate.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/delegates/amount?address=0x0000000000000000000000000000000000000000
```

### Claim app leaderboard search

- **Method and URL**: `GET https://claim.superfluid.org/api/leaderboard/search?address=<address>`
- **Classification**: claim-app-local.
- **Query parameters**:
  - `address` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Observed client purpose: searches leaderboard data for the connected account.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://claim.superfluid.org/api/leaderboard/search?address=0x0000000000000000000000000000000000000000
```

### Airdrop eligibility worker

- **Method and URL**: `GET https://superfluid-airdrop.goodworker.workers.dev/?address=<address>`
- **Classification**: external.
- **Query parameters**:
  - `address` (required by observed client code): Ethereum address.
- **Body parameters**: none.
- **Minimal successful response example**: Unknown / needs capture.
- **Missing/error response example**: Unknown / needs capture.
- **Notes**:
  - Used by the claim app for airdrop eligibility/status.

#### Unknown / needs capture

Capture successful and missing/error responses for:

```text
GET https://superfluid-airdrop.goodworker.workers.dev/?address=0x0000000000000000000000000000000000000000
```

### Other claim-app external bases

The audit found these external bases/endpoints in claim-app bundles. Their exact operations or response bodies were not captured in the committed evidence.

| Method | URL/base | Classification | Known purpose | Unknown / needs capture |
| --- | --- | --- | --- | --- |
| Not observed as direct fetch | `https://superfluid-eligibility-api.s.superfluid.dev/api/referrals` | external | Exported referrals API base URL | Direct request shape and responses. |
| Not observed as direct fetch | `https://sup-metrics-api.superfluid.dev` | external | Exported SUP metrics API base URL | Direct request shape and responses. |
| GraphQL | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn` | external GraphQL | Production SUP subgraph endpoint | GraphQL operation and responses. |
| GraphQL | `https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn` | external GraphQL | Test SUP subgraph endpoint | GraphQL operation and responses. |
| GraphQL | `https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1` | external GraphQL | Protocol subgraph endpoint | GraphQL operation and responses. |
| GraphQL | `https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1` | external GraphQL | Protocol subgraph endpoint | GraphQL operation and responses. |
