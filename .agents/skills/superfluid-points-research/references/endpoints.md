# Superfluid points endpoint notes

## Public CMS points API

- Campaign metadata: `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`
- Point events: `GET https://cms.superfluid.pro/points/events?campaignId=<id>&limit=100&page=<page>`
- Batch balance/campaign existence check: `POST https://cms.superfluid.pro/points/balance-batch`

`/points/balance-batch` accepts up to 50 campaign IDs and an account. Use the zero address when only checking existence. Missing campaigns are returned in `warnings`.

## Check which campaigns have had funding start already

- Use CMS campaign metadata as the primary source: `GET https://cms.superfluid.pro/points/campaign?campaignId=<id>`.
- Confirm the exact funding-start field name from CMS source, schema, or documented route output before using it. Do not classify campaigns from guessed field names.
- Compare the confirmed timestamp with current UTC time. A campaign belongs in `funding started` only when the confirmed timestamp is present, parseable, and `<=` now in UTC; it belongs in `funding not started` when the confirmed timestamp is present, parseable, and `>` now in UTC.
- Treat missing, undocumented, ambiguous, or unparseable funding-start fields as `unknown`, not `false`.
- For many candidate IDs, use `POST /points/balance-batch` only to discover which campaign IDs exist, then fetch `/points/campaign` metadata for those existing IDs before checking funding status.
- Report three groups when needed:
  - funding started
  - funding not started
  - unknown because metadata lacks a confirmed funding-start field

Unknown response shape needed: the exact CMS campaign funding-start response field is not currently documented here. Verify the field name from CMS source/schema/docs before using it.

## Claim app Next.js action

- Host: `https://claim.superfluid.org/`
- Server action header: `next-action: 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f`
- Body: `[]`
- Response: React Flight text; parse the line prefixed with `1:` as JSON.

## Known distinction

Claim app program IDs and offchain CMS campaign IDs overlap but are not identical. A claim route ID may be a valid onchain program while `/points/campaign` returns `Campaign not found`.
