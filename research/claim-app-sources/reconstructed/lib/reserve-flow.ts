export function sumReserveFlowRates(
  cfaFlowRate: bigint,
  programFlowRates: readonly bigint[],
): bigint {
  return programFlowRates.reduce((total, rate) => total + rate, cfaFlowRate);
}
