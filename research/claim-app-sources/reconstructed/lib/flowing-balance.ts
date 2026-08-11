const TOKEN_DECIMALS = 18;

export const LIVE_BALANCE_UPDATES_PER_SECOND = 4;

export function calculateFlowingBalance(
  balance: bigint,
  balanceTimestampMs: bigint,
  flowRate: bigint,
  nowMs: bigint,
  maxBalance?: bigint,
): bigint {
  const elapsedMs = nowMs > balanceTimestampMs ? nowMs - balanceTimestampMs : 0n;
  const flowing = balance + (flowRate * elapsedMs) / 1_000n;

  return maxBalance !== undefined && flowing > maxBalance
    ? maxBalance
    : flowing;
}

export function maskFastBalanceDigits(
  formattedBalance: string,
  flowRate: bigint,
  updatesPerSecond = LIVE_BALANCE_UPDATES_PER_SECOND,
): string {
  const absoluteFlowRate = flowRate < 0n ? -flowRate : flowRate;
  if (absoluteFlowRate === 0n) return formattedBalance;

  const decimalIndex = formattedBalance.indexOf(".");
  const integerDigits = [...formattedBalance.slice(0, decimalIndex < 0 ? undefined : decimalIndex)]
    .filter((character) => /\d/.test(character)).length;
  let digitPosition = 0;
  let mask = false;

  return [...formattedBalance]
    .map((character) => {
      if (!/\d/.test(character)) return character;

      const tokenExponent = integerDigits - digitPosition - 1;
      const rawExponent = TOKEN_DECIMALS + tokenExponent;
      const rawPlace = 10n ** BigInt(rawExponent);
      digitPosition += 1;

      if (absoluteFlowRate > BigInt(updatesPerSecond) * rawPlace) mask = true;
      return mask ? "-" : character;
    })
    .join("");
}
