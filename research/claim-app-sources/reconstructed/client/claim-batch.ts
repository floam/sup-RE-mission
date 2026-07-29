import { getAddress, isAddress, type Address } from "viem";

export function validateCmsCampaignBatch(input: {
  label: string;
  expectedAccount: Address;
  expectedCampaignIds: readonly number[];
  responseAccount: string;
  campaignIds: readonly number[];
  pointArrays: readonly (readonly number[])[];
}) {
  if (
    !isAddress(input.responseAccount) ||
    getAddress(input.responseAccount) !== input.expectedAccount
  ) {
    throw new Error(`${input.label} returned a different account.`);
  }

  if (input.campaignIds.length !== input.expectedCampaignIds.length) {
    throw new Error(`${input.label} returned an unexpected campaign count.`);
  }

  for (const [index, expectedId] of input.expectedCampaignIds.entries()) {
    if (input.campaignIds[index] !== expectedId) {
      throw new Error(`${input.label} returned campaigns out of request order.`);
    }
  }

  if (
    input.pointArrays.some(
      (points) => points.length !== input.expectedCampaignIds.length,
    )
  ) {
    throw new Error(`${input.label} returned an unexpected points-array length.`);
  }
}
