import assert from "node:assert/strict";
import test from "node:test";

import { getAddress } from "viem";

import { validateCmsCampaignBatch } from "./claim-batch.ts";

const account = getAddress("0xdBb811EC62338db94858Ec21ef1d56B658111922");

function validInput() {
  return {
    label: "CMS balance batch",
    expectedAccount: account,
    expectedCampaignIds: [607, 608],
    responseAccount: account.toLowerCase(),
    campaignIds: [607, 608],
    pointArrays: [
      [10, 20],
      [10, 1],
    ],
  } as const;
}

test("accepts a matching account, campaign order, and parallel arrays", () => {
  assert.doesNotThrow(() => validateCmsCampaignBatch(validInput()));
});

test("rejects a response for a different account", () => {
  assert.throws(
    () =>
      validateCmsCampaignBatch({
        ...validInput(),
        responseAccount: "0x0000000000000000000000000000000000000001",
      }),
    /different account/,
  );
});

test("rejects reordered campaigns even when the same IDs are present", () => {
  assert.throws(
    () =>
      validateCmsCampaignBatch({
        ...validInput(),
        campaignIds: [608, 607],
      }),
    /out of request order/,
  );
});

test("rejects truncated point arrays", () => {
  assert.throws(
    () =>
      validateCmsCampaignBatch({
        ...validInput(),
        pointArrays: [[10, 20], [10]],
      }),
    /points-array length/,
  );
});
