# Point-event export

`export-point-event-names.ts` is a command-line export utility. It builds
an HTML catalog of observed CMS point-event names while keeping onchain
program existence, claim-app attribution, and CMS campaign existence separate.

## Run

From the repository root:

```sh
npm run export:point-events
```

By default, the utility writes `tools/point-events/point-event-names.html` and
uses `.cache/point-event-names.json` for successful live responses. Both paths can
be changed with `--out=<path>` and `--cache=<path>`.

```sh
npm run export:point-events -- \
  --out=/tmp/point-event-names.html \
  --cache=/tmp/point-event-names.json \
  --campaign-ids=607,611 \
  --max-campaign-id=9999 \
  --concurrency=24
```

## What the report checks

| Data category                | Source                      | Purpose                                                    |
| :--------------------------- | :-------------------------- | :--------------------------------------------------------- |
| Onchain program lifecycle    | SUP Goldsky subgraph        | Enumerates `Program` entities and lifecycle fields.        |
| Live pool state              | Base RPC                    | Verifies `getProgramPool` and reads `getTotalFlowRate`.    |
| Indexed pool enrichment      | Base protocol subgraph      | Adds member, unit, and indexed-flow context.               |
| App attribution              | Claim `/api/programs`       | Adds claim-app names, seasons, app IDs, and pool metadata. |
| Offchain campaign and events | CMS `/points/*`             | Resolves campaigns and fetches event pages.                |
| CMS-only ID discovery        | CMS `/points/balance-batch` | Scans candidate IDs in batches of 50.                      |

The generated report labels failures per source rather than treating any single
source as conclusive. It coalesces trailing hash-like event-name suffixes only for
presentation; the original observed names remain in the report.

## Event-page coverage

All pages are fetched for Season 6+ campaigns and for configured active
pre-Season-6 campaign IDs. Finished pre-Season-6 campaigns are sampled from the
first and final pages. Therefore the report is an observed-event catalog, not a
complete historical registry unless its per-campaign mode is `full`.

See `skills/superfluid-points-research/references/endpoints.md` for endpoint
semantics and `PROVENANCE.md` for the generated-artifact policy.
