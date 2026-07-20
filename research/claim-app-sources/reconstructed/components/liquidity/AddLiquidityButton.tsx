"use client";

import { useState } from "react";

import { useLocker } from "../../contexts/LockerContext";
import { AddLiquidityDialog } from "./AddLiquidityDialog";

export function AddLiquidityButton({
  hasPositions,
}: {
  hasPositions: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { accountAddress, lockerAddress } = useLocker();
  return (
    <>
      <button
        className="rounded-full bg-green-sf px-16 text-lg"
        data-testid="add-liquidity-button"
        disabled={!accountAddress || !lockerAddress}
        onClick={() => setIsOpen(true)}
      >
        {hasPositions ? "Manage Liquidity" : "Add Liquidity"}
      </button>
      <AddLiquidityDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
