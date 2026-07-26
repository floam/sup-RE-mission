import assert from "node:assert/strict";
import test from "node:test";

import { isClaimablePointState } from "./claim-state.ts";

test("allows an outdated point target that reduces units to zero", () => {
  assert.equal(
    isClaimablePointState({
      offchainPoints: 0n,
      onchainPoints: 100n,
      isOnchainOutdated: true,
    }),
    true,
  );
});

test("does not claim a point target that already matches onchain units", () => {
  assert.equal(
    isClaimablePointState({
      offchainPoints: 100n,
      onchainPoints: 100n,
      isOnchainOutdated: false,
    }),
    false,
  );
});
