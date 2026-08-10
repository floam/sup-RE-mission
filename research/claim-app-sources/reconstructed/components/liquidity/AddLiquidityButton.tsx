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
        data-testid="add-liquidity-button"
        disabled={!accountAddress || !lockerAddress}
        onClick={() => setIsOpen(true)}
      >
        [ {hasPositions ? "manage liquidity" : "add liquidity"} ]
      </button>
      <AddLiquidityDialog isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
