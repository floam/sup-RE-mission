"use client";

import { FlowingBalance } from "../FlowingBalance";
import {
  formatCompactTokenAmount,
  formatMonthlyFlowRate,
} from "../../lib/format";

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
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full items-stretch overflow-hidden rounded-[20px] border-2 ${isSelected ? "border-green" : "border-transparent"}`}
    >
      <div className="flex flex-[0.8] items-center justify-center bg-[#2D5F4D] px-6 py-4 text-white">
        ◉ {formatCompactTokenAmount(amount)}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center bg-platinum px-6 py-4">
        <span className="text-caption3 uppercase">SUP Per Month</span>
        <span>{formatMonthlyFlowRate(flowRate)}</span>
      </div>
      <div className="flex flex-[1.5] flex-col items-center justify-center bg-platinum px-6 py-4">
        <span className="text-caption3 uppercase">Withdrawn So Far</span>
        <FlowingBalance
          balance={0n}
          balanceTimestamp={Number(fontaine.blockTimestamp)}
          flowRate={flowRate}
          maxBalance={amount}
        />
      </div>
    </button>
  );
}
