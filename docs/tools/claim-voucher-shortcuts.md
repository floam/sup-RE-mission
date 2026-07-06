# Superfluid claim voucher Shortcuts injector

`claim-voucher-shortcuts.js` is a Safari Shortcuts-compatible JavaScript payload for `https://claim.superfluid.com` and `https://claim.superfluid.org`.

The injector displays point-state deltas from the claim app, lets the user include or exclude campaigns, caches vouchers in `localStorage`, and arms a selected voucher by intercepting the claim app's `/api/points/claim` fetch response.

## Voucher sources

The script supports three voucher sources:

1. Claim-app batch vouchers from `/api/points/claim?accountAddress=<address>`.
2. CMS exact subset batch vouchers from `https://cms.superfluid.pro/points/signed-balance-batch`.
3. CMS single-campaign vouchers from `https://cms.superfluid.pro/points/signed-balance?campaignId=<id>&account=<address>` with a plural `/points/signed-balances` fallback for deployments that expose that alias.

Single-campaign CMS vouchers make subsets possible by allowing each campaign to be claimed with a valid single voucher. The script deliberately does not concatenate multiple single signatures into one batch signature, because multi-campaign claims need a single signature over exactly the selected campaign ID and point arrays.

## Nonce behavior

The claim app and CMS signed-balance endpoints use `signatureTimestamp` as the voucher nonce. The injector tracks the latest cached nonce for the wallet and marks older vouchers as stale before arming them.
