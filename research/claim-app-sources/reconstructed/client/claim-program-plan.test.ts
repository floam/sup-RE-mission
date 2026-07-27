import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaimProgramPlan,
  fetchCmsBatches,
  getClaimResultKind,
} from "./claim-program-plan.ts";
import type { PublicProgram } from "./programs.ts";

function program(
  id: number,
  overrides: Partial<PublicProgram> = {},
): PublicProgram {
  return {
    id: String(id),
    distributionPool: `0x${id.toString(16).padStart(40, "0")}`,
    fundingAmount: "0",
    subsidyAmount: "0",
    earlyEndDate: null,
    endDate: "2000",
    stoppedDate: null,
    cancellationDate: null,
    ...overrides,
  };
}

test("queries every authoritative program even when none are active", async () => {
  const programs = Array.from({ length: 75 }, (_, index) =>
    program(index + 1, { stoppedDate: "1000" }),
  );
  const plan = buildClaimProgramPlan(programs, 1500);
  const calls: number[][] = [];

  await fetchCmsBatches(plan.cmsBatches, async (campaignIds) => {
    calls.push(campaignIds);
    return { campaignIds };
  });

  assert.equal(plan.comparablePrograms.length, 0);
  assert.equal(plan.cmsCampaignIds.length, 75);
  assert.deepEqual(calls.map((batch) => batch.length), [50, 25]);
  assert.deepEqual(calls.flat(), plan.cmsCampaignIds);
});

test("keeps active programs comparable while still querying finished programs", () => {
  const plan = buildClaimProgramPlan(
    [
      program(1, { endDate: "2000" }),
      program(2, { endDate: "1000" }),
      program(3, { stoppedDate: "1200" }),
    ],
    1500,
  );

  assert.deepEqual(plan.cmsCampaignIds, [1, 2, 3]);
  assert.deepEqual(
    plan.comparablePrograms.map((item) => item.id),
    ["1"],
  );
});

test("deduplicates campaign IDs before constructing CMS batches", () => {
  const plan = buildClaimProgramPlan([program(1), program(1), program(2)], 1500);

  assert.deepEqual(plan.cmsCampaignIds, [1, 2]);
  assert.deepEqual(plan.cmsBatches, [[1, 2]]);
});

test("propagates a CMS batch failure instead of producing a success state", async () => {
  await assert.rejects(
    fetchCmsBatches([[1, 2]], async () => {
      throw new Error("CMS unavailable");
    }),
    /CMS unavailable/,
  );
});

test("does not label an empty comparison set as synchronized", () => {
  assert.equal(
    getClaimResultKind({
      lockerReady: true,
      comparableProgramCount: 0,
      changedProgramCount: 0,
    }),
    "no-active-programs",
  );
});

test("labels a verified unchanged comparison set as synchronized", () => {
  assert.equal(
    getClaimResultKind({
      lockerReady: true,
      comparableProgramCount: 3,
      changedProgramCount: 0,
    }),
    "synchronized",
  );
});

test("prioritizes a missing locker over campaign result labels", () => {
  assert.equal(
    getClaimResultKind({
      lockerReady: false,
      comparableProgramCount: 3,
      changedProgramCount: 2,
    }),
    "locker-required",
  );
});
