import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicProgramAttributions,
  mergeProgramAttributions,
} from "./program-attribution.ts";

test("loads newly published claim-program attribution", async () => {
  const attributions = await getPublicProgramAttributions(async () =>
    Response.json({
      json: [
        {
          name: "GoodDollar Ecosystem",
          category: "Donations",
          season: "6",
          program: { id: 614 },
        },
        {
          name: "Dashboard Clear Macro Rewards",
          category: "Other",
          season: "6",
          program: { id: 615 },
        },
      ],
      meta: {},
    }),
  );

  assert.deepEqual(attributions.get(614), {
    names: ["GoodDollar Ecosystem"],
    descriptors: ["Season 6 · Donations"],
  });
  assert.deepEqual(attributions.get(615), {
    names: ["Dashboard Clear Macro Rewards"],
    descriptors: ["Season 6 · Other"],
  });
});

test("live attribution replaces a recovered fallback for the same program", () => {
  const merged = mergeProgramAttributions(
    new Map([
      [606, { names: ["GoodDollar"], descriptors: ["Season 6 · Other"] }],
    ]),
    new Map([
      [
        606,
        {
          names: ["GoodDollar Actions"],
          descriptors: ["Season 6 · Social"],
        },
      ],
    ]),
  );

  assert.deepEqual(merged.get(606), {
    names: ["GoodDollar Actions"],
    descriptors: ["Season 6 · Social"],
  });
});

test("rejects a malformed claim-program response", async () => {
  await assert.rejects(
    getPublicProgramAttributions(async () => Response.json({ programs: [] })),
    /malformed payload/,
  );
});
