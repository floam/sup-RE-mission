import assert from "node:assert/strict";
import test from "node:test";

import { projectMemberFlowRate } from "./flow-projection.ts";

test("projects a member's share after its units increase", () => {
  assert.equal(
    projectMemberFlowRate({
      currentUnits: 10n,
      targetUnits: 20n,
      totalUnits: 100n,
      totalFlowRate: 1_000n,
    }),
    181n,
  );
});

test("projects zero flow when a claim removes all member units", () => {
  assert.equal(
    projectMemberFlowRate({
      currentUnits: 10n,
      targetUnits: 0n,
      totalUnits: 100n,
      totalFlowRate: 1_000n,
    }),
    0n,
  );
});

test("handles an otherwise empty pool", () => {
  assert.equal(
    projectMemberFlowRate({
      currentUnits: 0n,
      targetUnits: 25n,
      totalUnits: 0n,
      totalFlowRate: 500n,
    }),
    500n,
  );
});
