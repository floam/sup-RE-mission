import assert from "node:assert/strict";
import test from "node:test";

import { getClaimNonceWindow } from "./claim-nonce-window.ts";

test("derives the last claimed nonce from getNextValidNonce", () => {
  assert.deepEqual(getClaimNonceWindow(1_765_000_001n, 1_765_000_100), {
    lastClaimNonce: 1_765_000_000,
    currentNonce: 1_765_000_100,
    startTime: "2025-12-06T05:46:40.000Z",
    endTime: "2025-12-06T05:48:20.000Z",
  });
});

test("uses an open lower bound before the first claim", () => {
  assert.deepEqual(getClaimNonceWindow(1n, 100), {
    lastClaimNonce: 0,
    currentNonce: 100,
    startTime: null,
    endTime: "1970-01-01T00:01:40.000Z",
  });
});

test("rejects a signed snapshot that is not newer than the claimed nonce", () => {
  assert.throws(
    () => getClaimNonceWindow(102n, 101),
    /must be newer than the last claimed nonce/,
  );
  assert.throws(
    () => getClaimNonceWindow(102n, 100),
    /must be newer than the last claimed nonce/,
  );
});
