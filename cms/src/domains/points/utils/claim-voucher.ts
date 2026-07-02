/**
 * Claim-voucher freshness settings.
 *
 * FluidEPProgramManager treats the signed `nonce` as a monotonic per-user,
 * per-program value (`nonce > lastValidNonce`) and does not inspect wall-clock
 * time. The CMS uses Unix seconds as that nonce for Stack-compatible vouchers,
 * so clients and signer-rotation automation must treat these signatures as
 * short lived. If the on-chain program signer is rotated at least this often,
 * stale high-balance vouchers issued before a CMS correction are no longer
 * accepted after the rotation.
 */
export const SIGNED_BALANCE_MAX_AGE_SECONDS = 5 * 60

export function createClaimVoucherTimestamp(now = new Date()): {
	signatureTimestamp: number
	signatureExpiresAt: number
	signatureMaxAgeSeconds: number
} {
	const signatureTimestamp = Math.floor(now.getTime() / 1000)
	return {
		signatureTimestamp,
		signatureExpiresAt: signatureTimestamp + SIGNED_BALANCE_MAX_AGE_SECONDS,
		signatureMaxAgeSeconds: SIGNED_BALANCE_MAX_AGE_SECONDS,
	}
}
