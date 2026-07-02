# Superfluid points endpoint notes

## Public CMS points API

- Campaign metadata: `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`
- Point events: `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>`
- Batch balance/campaign existence check: `POST https://cms.superfluid.pro/points/balance-batch`

`/points/balance-batch` accepts up to 50 campaign IDs and an account. Use the zero address when only checking existence. Missing campaigns are returned in `warnings`.

## Claim app Next.js action

- Host: `https://claim.superfluid.org/`
- Server action header: `next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f`
- Body: `[]`
- Response: React Flight text; parse the line prefixed with `1:` as JSON.

## Known distinction

Claim app program IDs and offchain CMS campaign IDs overlap but are not identical. A claim route ID may be a valid onchain program while `/points/campaign` returns `Campaign not found`.
