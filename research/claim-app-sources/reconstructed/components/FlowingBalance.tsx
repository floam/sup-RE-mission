"use client";

import { useEffect, useRef, useState } from "react";

import { formatTokenAmount, inferDecimalPlaces } from "../lib/format";

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
  const frame = useRef<number>(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let lastUpdate = 0;
    const interval = flowRate === 0n ? 400 : 60;
    const tick = (time: number) => {
      if (time - lastUpdate >= interval) {
        lastUpdate = time;
        setNow(Date.now());
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [flowRate]);

  const timestampMs = BigInt(balanceTimestamp) * 1_000n;
  const elapsedMs = BigInt(Math.max(0, now - Number(timestampMs)));
  const flowing = balance + (flowRate * elapsedMs) / 1_000n;
  const displayed =
    maxBalance !== undefined && flowing > maxBalance ? maxBalance : flowing;

  return (
    <span className={className} data-testid={dataTestId}>
      {formatTokenAmount(displayed, decimalPlaces)}
    </span>
  );
}
