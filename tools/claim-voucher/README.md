# Superfluid claim voucher Shortcuts injector

`injector.js` is a Safari Shortcuts-compatible JavaScript payload for `https://claim.superfluid.org`.

The injector displays claim-app point-state deltas with campaign names/seasons from the public claim programs catalog, lets the user include or exclude positive outdated campaigns, fetches an exact CMS signed voucher for the selected campaign subset, caches vouchers in `localStorage`, and arms a selected voucher by intercepting the claim app's `/api/points/claim` lookup.

## Canonical endpoints

The script intentionally uses only the live claim host and the CMS batch signed-balance endpoint for voucher signing:

1. `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>`
2. `GET https://claim.superfluid.org/api/programs` for campaign labels, seasons, app IDs, pool addresses, and claim-app `onchainInfo`
3. `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>` for optional reference/debug only
4. `GET https://claim.superfluid.org/api/mystery-box/check?address=<address>` for optional UI/debug only
5. `POST https://cms.superfluid.pro/points/balance-batch` for optional diagnostics that compare claim-app state rows with CMS raw/capped balances
6. `POST https://cms.superfluid.pro/points/signed-balance-batch` for actual selected-subset vouchers

The claim-app `/api/points/states` rows appear to be assembled from the same CMS balance data used by `balance-batch`, with `offchainPoints` matching the capped/signed points rather than the uncapped raw points, plus onchain program units for `onchainPoints` and claim freshness. The tool's **Probe CMS states** action posts the currently visible state IDs to `/points/balance-batch` and logs any mismatch between claim-app `offchainPoints` and CMS capped balances.

The CMS batch endpoint supports both multi-campaign and one-campaign subsets, so there are no `/points/signed-balance` or `/points/signed-balances` fallbacks. Even a one-campaign CMS batch response is submitted as a batch-shaped claim transaction because the CMS batch endpoint signs array-typed payloads.

The tool does not POST to the SUP or protocol subgraphs when signing. Those subgraphs are useful for research and campaign discovery, but the voucher payload must stay aligned with the claim state rows and CMS signed-balance response.

## Voucher and cache correctness

Campaign rows use the observed `{ programId, offchainPoints, onchainPoints, isOnchainOutdated }` shape. The UI displays `offchainPoints - onchainPoints` as the delta, but the signed voucher uses the full target `offchainPoints` values. When CMS returns both `points` and `uncappedPoints`, the claim transaction and signature use `points`; `uncappedPoints` is displayed only as diagnostic context.

A cached voucher is considered reusable only when it has the same selected campaign ID set, is not stale by nonce, and still matches the current full offchain totals for every selected campaign. Lower cached nonces are marked stale only when a higher nonce exists for an overlapping campaign on the same account, because nonce validity is campaign-scoped. The tool does not expire vouchers by wall-clock time; CMS `signatureTimestamp` values are treated as the monotonic claim nonce/timestamp.

When no wallet or manual account override is available, account detection prefers visible claim-page text before generic page storage and skips this tool's own `localStorage` keys so an old voucher cache cannot select a different account. Armed vouchers are tied to the account used at arm time, and the fetch interceptor only serves them to matching `/api/points/claim?accountAddress=...` requests.

## Shortcuts behavior

The payload calls `completion(result)` exactly once immediately after the UI and fetch interceptor are installed. The UI continues to refresh state and handle user clicks inside the page after the Shortcut action has completed.
