export interface ClaimPointState {
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
  cmsCampaignExists: boolean;
}

export function isClaimablePointState(row: ClaimPointState): boolean {
  return row.cmsCampaignExists && row.isOnchainOutdated;
}

export function isPositiveClaimDelta(row: ClaimPointState): boolean {
  return isClaimablePointState(row) && row.offchainPoints > row.onchainPoints;
}
