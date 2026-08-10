import assert from "node:assert/strict";
import test from "node:test";

import { sumReserveFlowRates } from "./reserve-flow.ts";

test("adds SUP program distributions to the CFA net flow", () => {
  assert.equal(sumReserveFlowRates(-2n, [5n, 7n]), 10n);
});
