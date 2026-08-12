"use client";

import {
  formatCompactTokenAmount,
  formatMonthlyFlowRate,
} from "../../lib/format";
import { FlowingBalance } from "../FlowingBalance";

export interface Fontaine {
  id: string;
  recipient: string;
  unlockAmount: string;
  unlockFlowRate: string;
  blockTimestamp: string;
}

export function FontaineListItem({
  fontaine,
  isSelected,
  onSelect,
}: {
  fontaine: Fontaine;
  isSelected: boolean;
  onSelect(): void;
}) {
  const amount = BigInt(fontaine.unlockAmount);
  const flowRate = BigInt(fontaine.unlockFlowRate);
  return (
    <p>
      <button
        type="button"
        onClick={onSelect}
        className={isSelected ? "positive" : undefined}
      >
        {isSelected ? "[✓]" : "[ ]"} {formatCompactTokenAmount(amount)} SUP
      </button>{" "}
      <span>
        · {formatMonthlyFlowRate(flowRate)} SUP/mo · withdrawn{" "}
        <FlowingBalance
          balance={0n}
          balanceTimestamp={Number(fontaine.blockTimestamp)}
          flowRate={flowRate}
          maxBalance={amount}
        />
      </span>
    </p>
  );
}
