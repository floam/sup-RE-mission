import assert from "node:assert/strict";
import test from "node:test";

import {
  getAffectedClaimPointStates,
  getDefaultClaimSelection,
  isClaimablePointState,
  isPositiveClaimDelta,
  reconcileClaimSelection,
} from "./claim-state.ts";

test("lists only campaigns with a changed CMS target", () => {
  const affected = getAffectedClaimPointStates([
    {
      programId: 1n,
      offchainPoints: 100n,
      onchainPoints: 100n,
      isOnchainOutdated: false,
      cmsCampaignExists: true,
      isCapped: true,
    },
    {
      programId: 2n,
      offchainPoints: 90n,
      onchainPoints: 100n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
      isCapped: true,
    },
    {
      programId: 3n,
      offchainPoints: 0n,
      onchainPoints: 100n,
      isOnchainOutdated: true,
      cmsCampaignExists: false,
      isCapped: false,
    },
  ]);

  assert.deepEqual(
    affected.map((row) => row.programId),
    [2n],
  );
});

test("allows an outdated point target that reduces units to zero", () => {
  assert.equal(
    isClaimablePointState({
      offchainPoints: 0n,
      onchainPoints: 100n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
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
      cmsCampaignExists: true,
    }),
    false,
  );
});

test("does not claim a zero target synthesized for a CMS-missing campaign", () => {
  assert.equal(
    isClaimablePointState({
      offchainPoints: 0n,
      onchainPoints: 100n,
      isOnchainOutdated: true,
      cmsCampaignExists: false,
    }),
    false,
  );
});

test("selects positive claim deltas by default", () => {
  assert.equal(
    isPositiveClaimDelta({
      offchainPoints: 11n,
      onchainPoints: 10n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
    }),
    true,
  );
  assert.equal(
    isPositiveClaimDelta({
      offchainPoints: 9n,
      onchainPoints: 10n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
    }),
    false,
  );
});

test("builds the initial selection from positive claimable campaigns", () => {
  const selected = getDefaultClaimSelection([
    {
      programId: 1n,
      offchainPoints: 11n,
      onchainPoints: 10n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
    },
    {
      programId: 2n,
      offchainPoints: 9n,
      onchainPoints: 10n,
      isOnchainOutdated: true,
      cmsCampaignExists: true,
    },
  ]);

  assert.deepEqual([...selected], [1n]);
});

test("preserves explicit exclusions after a claim-state refresh", () => {
  const selected = reconcileClaimSelection(
    [
      {
        programId: 1n,
        offchainPoints: 11n,
        onchainPoints: 10n,
        isOnchainOutdated: true,
        cmsCampaignExists: true,
      },
      {
        programId: 2n,
        offchainPoints: 22n,
        onchainPoints: 20n,
        isOnchainOutdated: true,
        cmsCampaignExists: true,
      },
    ],
    new Set([2n]),
  );

  assert.deepEqual([...selected], [2n]);
});

test("drops selected campaigns that are no longer claimable", () => {
  const selected = reconcileClaimSelection(
    [
      {
        programId: 1n,
        offchainPoints: 11n,
        onchainPoints: 11n,
        isOnchainOutdated: false,
        cmsCampaignExists: true,
      },
    ],
    new Set([1n]),
  );

  assert.deepEqual([...selected], []);
});
