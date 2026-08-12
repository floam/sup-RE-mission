export interface ClaimPointState {
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
  cmsCampaignExists: boolean;
}

export interface SelectableClaimPointState extends ClaimPointState {
  programId: bigint;
}

export function isClaimablePointState(row: ClaimPointState): boolean {
  return row.cmsCampaignExists && row.isOnchainOutdated;
}

export function isPositiveClaimDelta(row: ClaimPointState): boolean {
  return isClaimablePointState(row) && row.offchainPoints > row.onchainPoints;
}

export function getAffectedClaimPointStates<Row extends ClaimPointState>(
  rows: readonly Row[],
): Row[] {
  return rows.filter(isClaimablePointState);
}

export function getDefaultClaimSelection(
  rows: readonly SelectableClaimPointState[],
): Set<bigint> {
  return new Set(rows.filter(isPositiveClaimDelta).map((row) => row.programId));
}

export function reconcileClaimSelection(
  rows: readonly SelectableClaimPointState[],
  selectedPrograms: ReadonlySet<bigint>,
): Set<bigint> {
  return new Set(
    rows
      .filter(
        (row) =>
          isClaimablePointState(row) && selectedPrograms.has(row.programId),
      )
      .map((row) => row.programId),
  );
}
