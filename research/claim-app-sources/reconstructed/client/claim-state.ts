export interface ClaimPointState {
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
}

export function isClaimablePointState(row: ClaimPointState): boolean {
  return row.isOnchainOutdated;
}
