import assert from "node:assert/strict";
import test from "node:test";

import { getEventFamily, groupCmsEvents } from "./event-groups.ts";

const firstAddress = "0x0067640009aa73c398e2a862d6c026682984b499";
const secondAddress = "0x082071bd0ff334e339cdbd3948ff30932aa35286";
const genericIdentifier = "abcdef345533335664445654";

test("recognizes trailing identifiers as one semantic event family", () => {
  assert.deepEqual(getEventFamily(`mystery-box-${firstAddress}`), {
    key: "mystery-box",
    displayName: "Mystery box",
  });
  assert.deepEqual(getEventFamily(`nft-mint-${genericIdentifier}`), {
    key: "nft-mint",
    displayName: "NFT mint",
  });
  assert.deepEqual(getEventFamily("claimed"), {
    key: "claimed",
    displayName: "Claimed",
  });
});

test("collapses exact event names into one family total", () => {
  const groups = groupCmsEvents([
    {
      id: 1,
      eventName: `mystery-box-${firstAddress}`,
      points: 12,
      createdAt: "2026-07-20T01:00:00.000Z",
    },
    {
      id: 2,
      eventName: `mystery-box-${firstAddress}`,
      points: 30,
      createdAt: "2026-07-21T01:00:00.000Z",
    },
  ]);

  assert.deepEqual(groups, [
    {
      key: "mystery-box",
      displayName: "Mystery box",
      count: 2,
      totalPoints: 42,
      firstCreatedAt: "2026-07-20T01:00:00.000Z",
      latestCreatedAt: "2026-07-21T01:00:00.000Z",
    },
  ]);
});

test("groups different identifiers into one count and point total", () => {
  const groups = groupCmsEvents([
    {
      id: 1,
      eventName: `nft-mint-${firstAddress}`,
      points: 10,
      createdAt: "2026-07-21T01:00:00.000Z",
    },
    {
      id: 2,
      eventName: `nft-mint-${secondAddress}`,
      points: 10,
      createdAt: "2026-07-22T01:00:00.000Z",
    },
    {
      id: 3,
      eventName: `nft-mint-${genericIdentifier}`,
      points: 10,
      createdAt: "2026-07-23T01:00:00.000Z",
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "nft-mint");
  assert.equal(groups[0].displayName, "NFT mint");
  assert.equal(groups[0].count, 3);
  assert.equal(groups[0].totalPoints, 30);
});

test("normalizes case without merging unrelated event families", () => {
  const groups = groupCmsEvents([
    {
      id: 1,
      eventName: `Mystery-Box-${firstAddress.toUpperCase().replace("0X", "0x")}`,
      points: 1,
      createdAt: "2026-07-21T01:00:00.000Z",
    },
    {
      id: 2,
      eventName: `mystery-box-${firstAddress}`,
      points: 2,
      createdAt: "2026-07-22T01:00:00.000Z",
    },
    {
      id: 3,
      eventName: `referral-${secondAddress}`,
      points: 3,
      createdAt: "2026-07-23T01:00:00.000Z",
    },
  ]);

  assert.equal(groups.length, 2);
  const mysteryBox = groups.find((group) => group.key === "mystery-box");
  const referral = groups.find((group) => group.key === "referral");
  assert(mysteryBox);
  assert(referral);
  assert.equal(mysteryBox.count, 2);
  assert.equal(mysteryBox.totalPoints, 3);
  assert.equal(referral.count, 1);
  assert.equal(referral.totalPoints, 3);
});
