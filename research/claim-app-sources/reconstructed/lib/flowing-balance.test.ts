import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFlowingBalance,
  maskFastBalanceDigits,
} from "./flowing-balance.ts";

test("projects a balance from its snapshot at the current flow rate", () => {
  assert.equal(
    calculateFlowingBalance(6_618n * 10n ** 18n, 1_000n, 10n ** 16n, 2_500n),
    6_618_015n * 10n ** 15n,
  );
});

test("does not project before the snapshot timestamp", () => {
  assert.equal(calculateFlowingBalance(12n, 2_000n, 10n, 1_000n), 12n);
});

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
