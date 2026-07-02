/**
 * Minimal proof of concept for FluidLocker/FluidEPProgramManager claim vouchers.
 *
 * The on-chain program manager validates only `nonce > lastValidNonce`; it does
 * not compare `nonce` to block.timestamp. Because the CMS signs Unix seconds as
 * nonce, an unsubmitted high-balance voucher remains valid after the CMS balance
 * decreases as long as its nonce is still above the on-chain last nonce and the
 * program signer has not been rotated.
 *
 * Gardens-style pattern:
 *   day 1: +1, then -1
 *   day 2: +5, then -5
 *   day 3: +2, then -2
 * A user who obtains the +5 voucher before the -5 correction can submit it after
 * the CMS balance is reduced to 0 if no newer claim has bumped the on-chain
 * nonce and no signer rotation/contract-side epoch has invalidated it.
 */

type Voucher = {
	label: string
	totalProgramUnits: number
	nonce: number
}

function isNonceAccepted(lastValidNonce: number, voucher: Voucher): boolean {
	return voucher.nonce > lastValidNonce
}

const gardensVouchers: Voucher[] = [
	{ label: "day 1 +1", totalProgramUnits: 1, nonce: 1_700_000_100 },
	{ label: "day 1 -1 corrected balance", totalProgramUnits: 0, nonce: 1_700_086_300 },
	{ label: "day 2 +5 stale high voucher", totalProgramUnits: 5, nonce: 1_700_086_500 },
	{ label: "day 2 -5 corrected balance", totalProgramUnits: 0, nonce: 1_700_172_700 },
	{ label: "day 3 +2", totalProgramUnits: 2, nonce: 1_700_172_900 },
]

const lastValidNonce = 0
const staleHighVoucher = gardensVouchers[2]
const currentCmsBalanceAfterCorrection = gardensVouchers[3].totalProgramUnits
const accepted = isNonceAccepted(lastValidNonce, staleHighVoucher)

console.log(
	JSON.stringify(
		{
			campaign: "Gardens",
			currentCmsBalanceAfterCorrection,
			staleHighVoucher,
			lastValidNonce,
			acceptedByFluidEPProgramManagerNonceRule: accepted,
			impact: accepted
				? "stale voucher can set on-chain units above the corrected CMS balance"
				: "stale voucher rejected",
		},
		null,
		2,
	),
)
