import assert from "node:assert/strict";
import test from "node:test";

import { abbreviateEventName, groupCmsEvents } from "./event-groups.ts";

const firstAddress = "0x0067640009aa73c398e2a862d6c026682984b499";
const secondAddress = "0x082071bd0ff334e339cdbd3948ff30932aa35286";

test("elides embedded EVM addresses without losing the event prefix", () => {
  assert.equal(
    abbreviateEventName(`foo-bar-${firstAddress}`),
    "foo-bar-0x0067…b499",
  );
  assert.equal(abbreviateEventName("claimed"), "claimed");
});

test("groups exact event names and sums their points", () => {
  const eventName = `mystery-box-${firstAddress}`;
  const groups = groupCmsEvents([
    {
      id: 1,
      eventName,
      points: 12,
      createdAt: "2026-07-20T01:00:00.000Z",
    },
    {
      id: 2,
      eventName,
      points: 30,
      createdAt: "2026-07-21T01:00:00.000Z",
    },
  ]);

  assert.deepEqual(groups, [
    {
      eventName,
      displayName: "mystery-box-0x0067…b499",
      count: 2,
      totalPoints: 42,
      latestCreatedAt: "2026-07-21T01:00:00.000Z",
    },
  ]);
});

test("does not merge different full names merely because both contain addresses", () => {
  const groups = groupCmsEvents([
    {
      id: 1,
      eventName: `mystery-box-${firstAddress}`,
      points: 1,
      createdAt: "2026-07-21T01:00:00.000Z",
    },
    {
      id: 2,
      eventName: `mystery-box-${secondAddress}`,
      points: 2,
      createdAt: "2026-07-22T01:00:00.000Z",
    },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].eventName, `mystery-box-${secondAddress}`);
  assert.equal(groups[1].eventName, `mystery-box-${firstAddress}`);
});
