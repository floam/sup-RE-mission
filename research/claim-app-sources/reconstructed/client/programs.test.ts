import assert from "node:assert/strict";
import test from "node:test";

import { getProgramStatus, getPublicPrograms } from "./programs.ts";

test('treats GraphQL timestamp "0" as not stopped', () => {
  assert.equal(
    getProgramStatus({ stoppedDate: "0", endDate: "200" }, 100),
    "Active",
  );
});

test("distinguishes stopped and naturally finished programs", () => {
  assert.equal(
    getProgramStatus({ stoppedDate: "90", endDate: "200" }, 100),
    "Stopped",
  );
  assert.equal(
    getProgramStatus({ stoppedDate: "0", endDate: "90" }, 100),
    "Finished",
  );
});

test("enumerates every SUP program page", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({
    id: String(index + 1).padStart(4, "0"),
    distributionPool: "0x0000000000000000000000000000000000000000",
    fundingAmount: "0",
    subsidyAmount: "0",
    endDate: "0",
    stoppedDate: "0",
  }));
  const requestedCursors: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as {
      variables: { lastId: string };
    };
    requestedCursors.push(request.variables.lastId);
    return Response.json({
      data: {
        programs:
          request.variables.lastId === ""
            ? firstPage
            : [{ ...firstPage[0], id: "1001" }],
      },
    });
  };

  const programs = await getPublicPrograms();

  assert.equal(programs.length, 1001);
  assert.deepEqual(requestedCursors, ["", "1000"]);
});
