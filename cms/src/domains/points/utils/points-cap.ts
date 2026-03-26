/**
 * Applies the points cap for a marked account.
 * Capped accounts receive 1 point; uncapped accounts keep their full balance.
 */
export function applyPointsCap(userPoints: number, isCapped: boolean): { points: number; uncappedPoints: number } {
	if (!isCapped || userPoints <= 0) {
		return { points: userPoints, uncappedPoints: userPoints }
	}
	return { points: 1, uncappedPoints: userPoints }
}
