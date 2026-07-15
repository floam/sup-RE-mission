---
name: superfluid-points-research
description: Research and implement Superfluid points / SPR campaign discovery, claim-app program lookup, and CMS points-event enumeration. Use when Codex needs to find hidden Superfluid points programs, inspect claim.superfluid.org Next.js routes/server actions, cross-check against cms.superfluid.pro points endpoints, or export point event names.
---

# Superfluid Points Research

## Core workflow

1. Treat `cms.superfluid.pro` as the source for offchain point-event data and campaign metadata.
2. Treat `claim.superfluid.org` as a source for onchain claim-program lists; it can include program IDs that do not have offchain CMS point events.
3. Cross-check both sources before concluding a campaign/program is missing.
4. Prefer batched endpoints and caching; do not brute-force `GET /points/campaign` one ID at a time unless no batch route is available.

## Known useful endpoints

- `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>` returns offchain CMS campaign metadata if the campaign exists.
- `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>` returns point events plus pagination.
- `POST https://cms.superfluid.pro/points/balance-batch` accepts up to 50 IDs:

```json
{
  "account": "0x0000000000000000000000000000000000000000",
  "campaignIds": [611, 9999]
}
```

The response includes `warnings: [{ campaignId, message: "Campaign not found" }]` for IDs missing from the offchain CMS. Use this to scan ranges such as `1..9999` in chunks of 50.

## claim.superfluid.org program list

The claim app uses a Next.js server action named `getProgramApps`. The action ID observed on July 2, 2026 was:

```text
0050c3f0d604f9162ceb3faa2d83005031b4be6b5f
```

Call it like this:

```bash
curl -sS -L 'https://claim.superfluid.org/' \
  -H 'next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f' \
  -H 'content-type: text/plain;charset=UTF-8' \
  -H 'accept: text/x-component' \
  --data-raw '[]'
```

The response is React Flight text. The line beginning with `1:` contains a JSON array of program apps. Parse that line by stripping the `1:` prefix and `JSON.parse` it. Extract IDs from `app.program?.id`.

If the action ID stops working, fetch `https://claim.superfluid.org`, download its `/_next/static/...js` chunks, and search for `getProgramApps`, `createServerReference`, `programApps`, `/api/points/states`, or `/api/points/claim` to find the new server action ID and related routes.

## Get position of an account on a leaderboard

Use this procedure for account position, place, rank, or leaderboard lookups. Campaign lookups require `campaignId`.

1. Validate and normalize the account address.
2. For campaign placement, confirm the campaign exists with `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`.
3. For campaign placement, use `GET https://cms.superfluid.pro/points/accounts?campaignId=<id>&account=<account>`. The returned `accounts[]` list is the sorted campaign leaderboard for the request.
4. For overall placement, use `GET https://claim.superfluid.org/api/leaderboard`.
5. Use server-provided `rank`, `place`, or list order. Do not recompute ranks from raw point events unless CMS code or docs define the ranking algorithm, tie handling, capped points behavior, and excluded events.

Campaign example:

```text
https://cms.superfluid.pro/points/accounts?campaignId=699&account=0xdBb811EC62338db94858Ec21ef1d56B658111922
```

Known campaign fields: `accounts[]`, `accounts[].account`, `accounts[].totalPoints`, `accounts[].eventCount`, and `accounts[].lastEventAt`. Also document any returned `rank`, `place`, `points`, `cappedPoints`, or equivalent fields when present.

## Important interpretation

- Claim route program IDs are onchain claim programs; not all of them resolve in `/points/campaign`.
- `/points/balance-batch` identifies offchain CMS campaign IDs, including hidden IDs above 1000.
- Report these sets separately: claim route IDs, balance-batch IDs, resolved CMS IDs, and missing-from-CMS IDs.
- For point-event names, only resolved CMS campaigns can be enumerated with `/points/events`.

## Performance defaults

- Use HTTP/2 curl requests when Node fetch cannot reach the network in the agent environment.
- Cache successful HTTP responses in a local JSON cache.
- Scan `/points/balance-batch` with chunks of 50 and bounded concurrency.
- For finished pre-Season-6 campaigns, sampling first and final `limit=100` pages may be enough for exploratory event-name reports; for Season 6+ and known in-progress older campaigns, fetch all pages.
