import { encodePacked, getAddress, isAddress, keccak256 } from "viem"
import { createClaimVoucherTimestamp } from "@/domains/points/utils/claim-voucher"
import { applyPointsCap } from "@/domains/points/utils/points-cap"
import { signMessageHash } from "@/domains/points/utils/signing"
import { getPayloadInstance } from "@/payload"

export const maxDuration = 30

const MAX_CAMPAIGNS = 50

/**
 * POST /points/signed-balance-batch
 *
 * Body: { campaignIds: number[], account: string }
 *
 * Returns a single signature covering multiple campaigns for the same account.
 * Enables batch on-chain claims.
 *
 * Signature message: keccak256(encodePacked([address, points[], campaigns[], timestamp]))
 */
export const POST = async (request: Request): Promise<Response> => {
	try {
		const body = await request.json()
		const { campaignIds, account } = body

		// Validate campaignIds array
		if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
			return Response.json({ message: "campaignIds must be a non-empty array" }, { status: 400 })
		}

		if (campaignIds.length > MAX_CAMPAIGNS) {
			return Response.json({ message: `Maximum ${MAX_CAMPAIGNS} campaigns allowed per request` }, { status: 400 })
		}

		// Validate all are positive integers
		const invalidIds: unknown[] = []
		const validIds: number[] = []

		for (const id of campaignIds) {
			if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
				invalidIds.push(id)
			} else {
				validIds.push(id)
			}
		}

		if (invalidIds.length > 0) {
			return Response.json(
				{
					message: "Invalid campaign IDs (must be positive integers)",
					invalid: invalidIds,
				},
				{ status: 400 },
			)
		}

		// Validate account
		if (typeof account !== "string") {
			return Response.json({ message: "account must be a string" }, { status: 400 })
		}

		const accountLower = account.toLowerCase()
		if (!isAddress(accountLower)) {
			return Response.json({ message: "Invalid Ethereum address" }, { status: 400 })
		}

		// Fetch all campaigns
		const payload = await getPayloadInstance()

		const campaignResult = await payload.find({
			collection: "campaigns",
			where: { id: { in: validIds } },
			limit: MAX_CAMPAIGNS,
			depth: 0,
			select: { id: true },
		})

		// Check all campaigns exist
		const foundIds = new Set(campaignResult.docs.map((c) => c.id))
		const missingIds = validIds.filter((id) => !foundIds.has(id))

		if (missingIds.length > 0) {
			return Response.json(
				{
					message: "One or more campaigns not found",
					missing: missingIds,
				},
				{ status: 404 },
			)
		}

		// Fetch balances for all campaigns
		// Construct balance IDs: campaignId:account
		const balanceIds = validIds.map((id) => `${id}:${accountLower}`)

		const balanceResult = await payload.find({
			collection: "point-balances",
			where: { id: { in: balanceIds } },
			limit: MAX_CAMPAIGNS,
			depth: 0,
			select: { campaign: true, totalPoints: true, capped: true },
		})

		// Create a map of campaignId -> { totalPoints, capped }
		const balanceMap = new Map<number, { totalPoints: number; capped: boolean }>()
		for (const balance of balanceResult.docs) {
			// Extract campaign ID from the balance ID (format: campaignId:account)
			const campaignId = typeof balance.campaign === "number" ? balance.campaign : balance.campaign?.id
			if (campaignId != null) {
				balanceMap.set(campaignId, { totalPoints: balance.totalPoints, capped: balance.capped ?? false })
			}
		}

		// Build points arrays in same order as requested campaigns
		const pointsArray: number[] = []
		const uncappedPointsArray: number[] = []
		for (const id of validIds) {
			const balance = balanceMap.get(id)
			const { points, uncappedPoints } = applyPointsCap(balance?.totalPoints ?? 0, balance?.capped ?? false)
			pointsArray.push(points)
			uncappedPointsArray.push(uncappedPoints)
		}

		// Create message hash: keccak256(encodePacked([address, points[], campaigns[], timestamp]))
		const { signatureTimestamp, signatureExpiresAt, signatureMaxAgeSeconds } = createClaimVoucherTimestamp()
		const checksumAddress = getAddress(accountLower)
		const messageHash = keccak256(
			encodePacked(
				["address", "uint256[]", "uint256[]", "uint256"],
				[
					checksumAddress,
					pointsArray.map((p) => BigInt(p)),
					validIds.map((id) => BigInt(id)),
					BigInt(signatureTimestamp),
				],
			),
		)

		// Sign the message hash
		const signingResult = await signMessageHash(messageHash)
		if (!signingResult) {
			console.error("SIGNER_PRIVATE_KEY is not configured")
			return Response.json({ message: "Signing not available" }, { status: 500 })
		}

		return Response.json({
			address: accountLower,
			campaignIds: validIds,
			points: pointsArray,
			uncappedPoints: uncappedPointsArray,
			signatureTimestamp,
			signatureExpiresAt,
			signatureMaxAgeSeconds,
			signature: signingResult.signature,
			signer: signingResult.signer,
		})
	} catch (error) {
		console.error("Failed to get batch signed balance:", error)

		return Response.json(
			{
				message: error instanceof Error ? error.message : "Failed to get batch signed balance",
			},
			{ status: 500 },
		)
	}
}
