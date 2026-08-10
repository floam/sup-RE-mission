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

test("keeps equal event names separate when their point amounts differ", () => {
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

  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map(({ displayName, count, totalPoints }) => ({
      displayName,
      count,
      totalPoints,
    })),
    [
      { displayName: "Mystery box", count: 1, totalPoints: 30 },
      { displayName: "Mystery box", count: 1, totalPoints: 12 },
    ],
  );
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
  assert.equal(groups[0].displayName, "NFT mint");
  assert.equal(groups[0].count, 3);
  assert.equal(groups[0].totalPoints, 30);
});

test("normalizes case without merging different families or point amounts", () => {
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

  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups.map(({ displayName, count, totalPoints }) => ({
      displayName,
      count,
      totalPoints,
    })),
    [
      { displayName: "Referral", count: 1, totalPoints: 3 },
      { displayName: "Mystery box", count: 1, totalPoints: 2 },
      { displayName: "Mystery box", count: 1, totalPoints: 1 },
    ],
  );
});
