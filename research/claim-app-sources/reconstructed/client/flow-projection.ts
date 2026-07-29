export function projectMemberFlowRate(input: {
  currentUnits: bigint;
  targetUnits: bigint;
  totalUnits: bigint;
  totalFlowRate: bigint;
}) {
  const projectedTotalUnits =
    input.totalUnits - input.currentUnits + input.targetUnits;
  if (projectedTotalUnits <= 0n || input.targetUnits <= 0n) return 0n;
  return (input.totalFlowRate * input.targetUnits) / projectedTotalUnits;
}
