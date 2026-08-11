"use client";

import { useEffect, useState } from "react";

import { formatTokenAmount, inferDecimalPlaces } from "../lib/format";
import {
  calculateFlowingBalance,
  LIVE_BALANCE_UPDATES_PER_SECOND,
  maskFastBalanceDigits,
} from "../lib/flowing-balance";

export interface FlowingBalanceProps {
  balance: bigint;
  balanceTimestamp: bigint | number;
  flowRate: bigint;
  maxBalance?: bigint;
  decimalPlaces?: number;
  className?: string;
  dataTestId?: string;
}

export function FlowingBalance({
  balance,
  balanceTimestamp,
  flowRate,
  maxBalance,
  decimalPlaces = inferDecimalPlaces(balance),
  className,
  dataTestId,
}: FlowingBalanceProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (flowRate === 0n) return;

    const interval = window.setInterval(
      () => setNow(Date.now()),
      1_000 / LIVE_BALANCE_UPDATES_PER_SECOND,
    );
    return () => window.clearInterval(interval);
  }, [flowRate]);

  const timestampMs = BigInt(balanceTimestamp) * 1_000n;
  const displayed = calculateFlowingBalance(
    balance,
    timestampMs,
    flowRate,
    BigInt(now),
    maxBalance,
  );
  const formattedBalance = formatTokenAmount(displayed, decimalPlaces);

  return (
    <span className={className} data-testid={dataTestId}>
      {maskFastBalanceDigits(formattedBalance, flowRate)}
    </span>
  );
}
