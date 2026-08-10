import assert from "node:assert/strict";
import test from "node:test";

import { maskFastBalanceDigits } from "./flowing-balance.ts";

test("masks the first digit that changes faster than the display refresh", () => {
  assert.equal(maskFastBalanceDigits("12.345678", 123_000_000_000_000n), "12.3456--");
});

test("preserves digits that change no more than four times per second", () => {
  assert.equal(maskFastBalanceDigits("12.3456", 4_000_000_000_000n), "12.3456");
});

test("masks fast integer digits while retaining separators", () => {
  assert.equal(maskFastBalanceDigits("1,234.56", 41_000_000_000_000_000_000n), "1,2--.--");
});

test("does not mask a static balance", () => {
  assert.equal(maskFastBalanceDigits("12.3456", 0n), "12.3456");
});
