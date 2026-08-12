# FluidEPProgramManager nonce staleness disclosure draft

Date: 2026-07-03

Hi there @kasparkallas @akhileshw @miaozc @elvijsdzirkals - so little disclosure here I think I have really found an exploitable issue this time.

First to recap how points work and are claimed:

1. Ecosystem Project BouncyCastle records that my wallet `0xfloam` earned 50 points.
2. Their server pushes that points event into the Superfluid CMS points system.
3. The CMS stores the event, rolls it into my campaign balance, and exposes that campaign balance through the points API.
4. When I claim, the claim app requests a CMS-signed balance voucher. For a single campaign the signed message is effectively `(address, points, campaignId, signatureTimestamp)`.
5. The claim app submits that voucher on-chain as `claim(programId, totalProgramUnits, nonce, stackSignature)`.
6. The important detail is that `nonce` is the CMS `signatureTimestamp`. It is not an expiry timestamp and it is not checked against wall-clock time on-chain; it is only checked as a monotonic value for that user/program.

## Executive summary

The issue is stale signed balance acceptance. If the CMS briefly believes a wallet has too many points, signs that high balance, and later corrects the balance downward, the old high-balance signature can still be valid on-chain.

That is because the contract-side nonce rule only answers: "is this voucher newer than the last voucher this user successfully used?" It does not answer: "is this voucher still the latest CMS balance?" A user who caches the high voucher and waits for the CMS correction can submit the stale voucher later, as long as they have not already advanced their on-chain nonce past it and the program signer has not been rotated.

This makes off-chain corrections non-final once a high balance has been signed. In a small `+5/-5` case the value may be small, but the bug class is significant: a larger temporary data-source error, sybil burst, or mistaken allocation can be crystallized on-chain by any user who saved the inflated signed voucher.

## Concrete stale-voucher scenario

Using BouncyCastle as a simplified example:

1. BouncyCastle pushes `+50` points for `0xfloam`.
2. I request a signed balance voucher from the CMS while my balance is 50.
3. The CMS returns a signature over `(0xfloam, 50, BouncyCastleCampaignId, timestamp T1)`.
4. BouncyCastle or Superfluid later realizes the event was wrong and pushes `-50`, so my CMS balance is now 0.
5. I do not request a newer signed voucher and I do not make a newer claim.
6. I submit the old voucher on-chain with `totalProgramUnits = 50` and `nonce = T1`.
7. If my last on-chain nonce for that campaign is less than `T1`, the monotonic nonce rule accepts the old voucher even though the CMS now says my balance is 0.

This bypasses the correction. The correction exists in CMS, but the old signature lets me claim the pre-correction balance on-chain.

## Sources reviewed

### CMS signature format

`GET /points/signed-balance` signs the packed tuple `(address, points, campaignId, timestamp)` and returns `signatureTimestamp` with the signature. The timestamp is generated from `Math.floor(Date.now() / 1000)` at signing time.

`POST /points/signed-balance-batch` signs `(address, points[], campaignIds[], timestamp)` and likewise returns a single `signatureTimestamp` for the batch.

The public API registry documents the same message layouts for both single and batch signed balances.

### On-chain claim ABI shape

The shipped ABIs expose Fluid EP manager and locker claim/update methods with a `nonce` parameter next to `totalProgramUnits`/`newUnits` and `stackSignature`. The manager exposes `getNextValidNonce(programId, user)`, and the locker exposes `claim(programId, totalProgramUnits, nonce, stackSignature)` plus batch variants.

The ABI confirms the timestamp is not passed as a deadline or expiry field. It is passed as `nonce`.

### Gardens correction pattern

CMS events for Gardens Season 6 campaign `607` include negative point events. In the first 2,000 fetched events for `607`, 679 events had `points < 0`.

One concrete account had a `+5` `governanceStakePoints` event on 2026-07-01 followed by a `-5` `governanceStakePoints` event on 2026-07-02:

- Account: `0xe9dc34b67006db0910a9761cb031d4bde67dce23`
- Positive event: `+5 governanceStakePoints` at `2026-07-01T04:03:00.541Z`
- Negative event: `-5 governanceStakePoints` at `2026-07-02T05:01:50.978Z`

That pattern is enough to show balances can decrease after a user could have obtained a higher signed voucher.

### Active Gardens program context

The claim app's `getProgramApps` server action returned active Gardens Season 6 program `607`, with pool `0x7A93cfa2420C8823a6564567F86DB3D1f4Ef1d40`, `isFundingStarted: true`, `isFundingFinished: false`, and `totalMembers: 94` at the time of review.

## Why monotonic nonce is insufficient

A monotonic nonce is good replay protection. It prevents the same or older voucher from being used after a newer voucher has already been accepted.

But replay protection is not freshness protection. A voucher can be both:

- monotonic relative to the user's last on-chain claim, and
- stale relative to the CMS's current corrected balance.

The contract has no independent way to know that the CMS balance changed after the signature was issued. Unless the payload includes an enforceable expiry, per-account balance version, revocation epoch, or snapshot root, the old signed balance remains valid under the contract's current nonce model.

## Impact assessment

The over-claim amount is the difference between the stale signed `totalProgramUnits` and the corrected CMS balance, converted through the program's distribution mechanics.

For isolated Gardens `+5/-5` corrections, the per-account impact may be low. The reason I still think this is bounty-worthy is that the same primitive applies to large temporary over-allocations. If a data source, partner integration, or campaign job temporarily credits many users or too many points, every user who obtains a high signed voucher before the correction can potentially claim that stale amount later.

Practical impact is bounded by:

- the size of the stale signed balance,
- available/future program funding,
- whether the user already submitted a newer claim,
- whether the signer is rotated before stale vouchers are submitted, and
- whether the program has already completed or exhausted its distributable amount.

## Recommended mitigations

1. Add an expiry/deadline to the signed payload and enforce it on-chain, for example `block.timestamp <= issuedAt + maxAge`.
2. Use a CMS-issued monotonic per `(campaignId, account)` balance version that increments on every balance mutation. Sign the version, not just wall-clock time.
3. Add a per-program or per-account revocation epoch so operators can invalidate all vouchers issued before a correction.
4. Include a campaign/account snapshot root or balance root in the signed payload and rotate it after corrections.
5. Add an emergency signer-rotation and stale-voucher invalidation runbook for erroneous signed balances.
6. Consider refusing to sign balances while a campaign has pending reversible events or an open correction window.

## Commands used

- `rg -n "signature|sign|nonce|totalProgramUnits|balance-batch|points.*claim|claim" cms/src --glob '!node_modules'`
- `sed -n '1,190p' cms/src/app/\(api\)/points/signed-balance/route.ts`
- `sed -n '1,190p' cms/src/app/\(api\)/points/signed-balance-batch/route.ts`
- `sed -n '436,565p' cms/src/domains/points/api/registry.ts`
- `python3` ABI inspection of `sdk/package/abis/FluidEPProgramManager.json`
- `curl` claim app `getProgramApps` server action for Gardens program metadata
- `curl` CMS `/points/events?campaignId=607&limit=100&page=<n>` for Gardens event sampling
- `date -u -d @1782301486`
