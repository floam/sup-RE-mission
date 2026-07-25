import assert from "node:assert/strict";
import test from "node:test";

import { getProgramStatus } from "./programs.ts";

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
