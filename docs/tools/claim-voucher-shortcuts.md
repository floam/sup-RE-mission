# Superfluid claim voucher Shortcuts injector

`claim-voucher-shortcuts.js` is a Safari Shortcuts-compatible JavaScript payload for `https://claim.superfluid.org`.

The injector displays claim-app point-state deltas, lets the user include or exclude positive outdated campaigns, fetches an exact CMS signed voucher for the selected campaign subset, caches vouchers in `localStorage`, and arms a selected voucher by intercepting the claim app's `/api/points/claim` lookup.

## Canonical endpoints

The script intentionally uses only the live claim host and the CMS batch signed-balance endpoint:

1. `GET https://claim.superfluid.org/api/points/states?accountAddress=<address>`
2. `GET https://claim.superfluid.org/api/points/claim?accountAddress=<address>` for optional reference/debug only
3. `GET https://claim.superfluid.org/api/mystery-box/check?address=<address>` for optional UI/debug only
4. `POST https://cms.superfluid.pro/points/signed-balance-batch` for actual selected-subset vouchers

The CMS batch endpoint supports both multi-campaign and one-campaign subsets, so there are no `/points/signed-balance` or `/points/signed-balances` fallbacks. Even a one-campaign CMS batch response is submitted as a batch-shaped claim transaction because the CMS batch endpoint signs array-typed payloads.

## Voucher and cache correctness

Campaign rows use the observed `{ programId, offchainPoints, onchainPoints, isOnchainOutdated }` shape. The UI displays `offchainPoints - onchainPoints` as the delta, but the signed voucher uses the full target `offchainPoints` values.

A cached voucher is considered reusable only when it has the same selected campaign ID set, is not stale by nonce, and still matches the current full offchain totals for every selected campaign. Lower cached nonces are marked stale only when a higher nonce exists for an overlapping campaign on the same account, because nonce validity is campaign-scoped. The tool does not expire vouchers by wall-clock time; CMS `signatureTimestamp` values are treated as the monotonic claim nonce/timestamp.

When no wallet or manual account override is available, account detection prefers visible claim-page text before generic page storage and skips this tool's own `localStorage` keys so an old voucher cache cannot select a different account. Armed vouchers are tied to the account used at arm time, and the fetch interceptor only serves them to matching `/api/points/claim?accountAddress=...` requests.

## Shortcuts behavior

The payload calls `completion(result)` exactly once immediately after the UI and fetch interceptor are installed. The UI continues to refresh state and handle user clicks inside the page after the Shortcut action has completed.
