# Campaign point-event view

`view-campaign-events.mjs` is an on-demand local viewer for CMS point events. It does
not build or persist an event-name catalog.

## Run

From the repository root:

```sh
npm run view:point-events
```

Open the printed local URL, enter a campaign ID, and choose **Load newest events**.
The viewer proxies requests to `https://cms.superfluid.pro/points/events` so the
browser does not need direct CMS CORS access.

Environment overrides:

```sh
HOST=127.0.0.1 PORT=4173 CMS_BASE_URL=https://cms.superfluid.pro \
  npm run view:point-events
```

## Bounded loading

The CMS endpoint accepts at most 100 events per page. One user action fetches at most
three consecutive pages, so no click can load more than 300 events. Pages are requested
in ascending page order starting at the requested page; because CMS returns point events
newest first by `eventTime` (exposed as `createdAt`), the combined rows remain
newest-first.

If more pages exist, the view exposes **Load 300 more** and continues from the next CMS
page. A new campaign load clears the prior rows and starts again from page 1.

This utility is intentionally a bounded inspection surface rather than a historical
registry. Use claim state, the SUP subgraph, direct Base RPC, and claim-app attribution
for their respective authoritative domains; use CMS events only for offchain point-event
history.

See `skills/superfluid-points-research/references/endpoints.md` for the CMS response
shape and `PROVENANCE.md` for generated-material policy.
