# FluidEPProgramManager nonce staleness assessment

Date: 2026-07-02

## Question assessed

Can a CMS-signed balance voucher whose `signatureTimestamp` is used as the on-chain nonce remain valid after a later CMS balance correction and be used to materially over-claim Superfluid points/SUP in Fluid EP programs?

## Short answer

Yes, the issue is real in the protocol shape reviewed: the CMS signs the current balance with a wall-clock `signatureTimestamp`, while the on-chain claim path treats that value only as a monotonic nonce. If a user obtains a signed voucher for a temporarily inflated balance and does not submit it, a later negative correction in the CMS does not revoke that voucher unless the user later submits a newer claim for the same program/user or the program signer is rotated.

This is bounty-worthy if the accepted impact includes unauthorized reward over-allocation or bypassing off-chain corrections. The severity is bounded by the user's maximum stale signed balance and by program funding/claim mechanics, but the primitive can turn any reversible/off-chain points correction into an on-chain final over-claim.

## Evidence reviewed

### CMS signature format

`GET /points/signed-balance` signs the packed tuple `(address, points, campaignId, timestamp)` and returns `signatureTimestamp` with the signature. The timestamp is generated from `Math.floor(Date.now() / 1000)` at signing time.

`POST /points/signed-balance-batch` signs `(address, points[], campaignIds[], timestamp)` and likewise returns a single `signatureTimestamp` for the batch.

The public API registry documents the same message layouts for both single and batch signed balances.

### On-chain claim ABI shape

The shipped ABIs expose the Fluid EP manager and locker claim/update methods with a `nonce` parameter next to `totalProgramUnits`/`newUnits` and `stackSignature`. The manager exposes `getNextValidNonce(programId, user)`, and the locker exposes `claim(programId, totalProgramUnits, nonce, stackSignature)` plus batch variants.

The ABI alone confirms the timestamp is not passed as an expiry/deadline field; it is passed as `nonce`.

### Claim app / on-chain program state

The claim app's `getProgramApps` server action returned active Gardens Season 6 program `607`, with pool `0x7A93cfa2420C8823a6564567F86DB3D1f4Ef1d40`, `isFundingStarted: true`, `isFundingFinished: false`, and `totalMembers: 94` at the time of review.


### June 24 claim nonce example

A submitted Gardens Season 6 claim with `programId = 607`, `totalProgramUnits = 99`, and `nonce = 1782301486` is not two months in the future. Interpreted as a Unix timestamp in seconds, `1782301486` is `2026-06-24T11:44:46Z`, which matches a June 24 submission date. The value is therefore consistent with the CMS `signatureTimestamp` design: the CMS signed around the time of submission/request, and the claim path supplied that timestamp as the on-chain `nonce`.

The future-looking dates in the Season 6 Gardens program metadata are separate program streaming dates, not the voucher nonce. In the claim app metadata reviewed, Gardens Season 6 had `fundingStartDate = 1780414401` (`2026-06-02T23:33:21Z`) and `fundingEndDate = 1788190401` (`2026-08-31T23:33:21Z`). Those values describe the program's funding window and should not be confused with the claim voucher's `nonce`.

### Gardens correction pattern

CMS events for campaign `607` include negative point events. In the first 2,000 fetched events for `607`, 679 events had `points < 0`. One concrete account had a `+5` `governanceStakePoints` event on 2026-07-01 followed by a `-5` `governanceStakePoints` event on 2026-07-02:

- Account: `0xe9dc34b67006db0910a9761cb031d4bde67dce23`
- Positive event: `+5 governanceStakePoints` at `2026-07-01T04:03:00.541Z`
- Negative event: `-5 governanceStakePoints` at `2026-07-02T05:01:50.978Z`

This pattern is sufficient to demonstrate that balances can decrease after a user could have obtained a signed voucher for the higher total.

## Exploitability assessment

### Required attacker steps

1. Earn or temporarily receive points in a campaign whose balance can later decrease.
2. Request `/points/signed-balance` or `/points/signed-balance-batch` while the CMS total is high.
3. Do not submit the voucher immediately.
4. Wait for the CMS to apply a negative correction.
5. Submit the old signed voucher on-chain, provided no newer successful claim for that same program/user has advanced the on-chain nonce past the voucher timestamp and the program signer has not been rotated.

### Why monotonic nonce is not enough

A monotonic nonce prevents replay and older-after-newer ordering, but it does not prove the signed balance is still the latest balance. A timestamp can be monotonic and stale at the same time. If the user's last on-chain nonce is below the old high voucher timestamp, the contract cannot distinguish the high voucher from the latest CMS state unless it enforces expiry, revocation, epoching, or a CMS-side nonce invalidation mechanism.

### Materiality

The direct over-claim is the difference between the stale signed `totalProgramUnits` and the corrected CMS balance, converted through the program's distribution mechanics. Gardens currently shows reversible events and active funding for Season 6, so the class is not theoretical. However, practical payout depends on:

- how many inflated vouchers an attacker can collect before corrections,
- the size of the point deltas,
- whether the program has available/future distributable SUP,
- whether claim UI/API behavior causes honest users to advance their nonce before they attempt stale vouchers,
- whether operators rotate the signer after discovering erroneous signed balances.

For isolated `+5/-5` corrections, impact may be low per user. For a data-source bug, sybil event burst, or large temporary allocation later corrected downward, impact can become significant because all users who cached high vouchers can crystallize the pre-correction balances on-chain.

## Bounty-worthiness

I would treat this as a valid bounty submission if the bounty scope includes reward-accounting integrity, stale signature acceptance, or unauthorized claim amount. It is not merely a UI issue: the stale voucher is independently accepted by the on-chain nonce model if the nonce is still above the stored nonce.

Suggested severity: medium by default, potentially high if a reproducible case can show meaningful SUP extraction from an active funded program or a realistic large negative correction.

## Recommended mitigations

1. Add an expiry/deadline to the signed payload and enforce it on-chain, e.g. `block.timestamp <= issuedAt + maxAge`.
2. Use a CMS-issued monotonic per `(campaignId, account)` version/counter that increments on every balance mutation, not wall-clock time.
3. Include a campaign/account `balanceVersion` or `snapshotRoot` in the signature and make corrections invalidate older versions.
4. Add an emergency per-program signer rotation/invalidation runbook for erroneous signed vouchers.
5. Consider refusing to sign balances for accounts/campaigns with pending/unsettled reversible events until the correction window closes.

## Commands used

- `rg -n "signature|sign|nonce|totalProgramUnits|balance-batch|points.*claim|claim" cms/src --glob '!node_modules'`
- `sed -n '1,190p' cms/src/app/\(api\)/points/signed-balance/route.ts`
- `sed -n '1,190p' cms/src/app/\(api\)/points/signed-balance-batch/route.ts`
- `sed -n '436,565p' cms/src/domains/points/api/registry.ts`
- `python3` ABI inspection of `sdk/package/abis/FluidEPProgramManager.json`
- `curl` claim app `getProgramApps` server action for Gardens program metadata
- `curl` CMS `/points/events?campaignId=607&limit=100&page=<n>` for Gardens event sampling
