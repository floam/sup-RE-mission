---
name: spr-point-events
description: Fetch, export, group, and analyze Superfluid Points Rewards point events globally or per account, with campaign/date filters and event-name normalization such as grouping eventName-0xabc123 hash suffixes by prefix. Use for CMS /points/events, /points/event-balance, point-event names, date windows, account history, and event prefix reports.
---

# SPR point events

Use this skill for raw/offchain point-event inspection and reports.

## Sources

- Primary: `GET https://cms.superfluid.pro/points/events`.
- Aggregates: `GET https://cms.superfluid.pro/points/event-balance`.
- Account/campaign leaderboard context: `GET https://cms.superfluid.pro/points/accounts`.
- Discovery input: resolved CMS campaign IDs from claim-app, SUP subgraph, or `/points/balance-batch`.

Only resolved CMS campaigns can be enumerated through `/points/events`; onchain-only SUP programs may not have CMS event rows.

## Query patterns

Global events for one campaign:

```text
GET /points/events?campaignId=<id>&limit=100&page=<page>
```

Per-account events:

```text
GET /points/events?campaignId=<id>&account=<address>&limit=100&page=<page>
```

Date-filtered events:

```text
GET /points/events?campaignId=<id>&startTime=<iso-or-unix>&endTime=<iso-or-unix>&limit=100&page=<page>
```

Exact event-name filter:

```text
GET /points/events?campaignId=<id>&eventName=<eventName>&limit=100&page=<page>
```

## Pagination defaults

- Fetch all pages for active/current campaigns and any account-specific investigation.
- For old ended campaigns, sampling may be acceptable only if the answer is explicitly exploratory.
- Always report `pagination.totalDocs`, `totalPages`, and whether the data is complete or sampled.

## Event-name grouping

When point event names include per-object suffixes, normalize them before grouping:

```text
<eventName>-0xabc123...  -> <eventName>-{hash}
<eventName>-abc123...    -> <eventName>-{hash}
```

Recommended regex:

```js
/(?:-)(?:0x)?[a-f0-9]{8,}$/i
```

Also group by prefix before the last hyphen when investigating families of events, but keep the raw examples so unique event types are not hidden.

## Report fields

For event-name reports include:

- raw event name count
- normalized event name count
- total points per normalized name
- positive/negative/net points
- unique account count
- first and last `createdAt`
- sample raw names

For per-account reports include:

- campaign ID/name
- account
- raw event count
- total points and capped/signed points when relevant
- rows grouped by normalized event name
- date window used

Reference shared endpoint details in `../superfluid-points-research/references/endpoints.md` when exact request/response shapes are needed.
