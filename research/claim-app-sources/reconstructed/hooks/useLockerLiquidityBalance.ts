"use client";

import { useMemo } from "react";
import { Position } from "@uniswap/v3-sdk";
import { parseUnits } from "viem";
import { useReadContracts } from "wagmi";

import { APP_CHAIN } from "../config/chains";
import {
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  nonfungiblePositionManagerAbi,
} from "../contracts/app-contracts";
import type { Address } from "../types/program-app";
import { useActiveLiquidityPositions } from "./useLiquidityPositions";
import { useEthSupPool } from "./useLiquidityPosition";

export interface LockerLiquidityBalance {
  totalSUPBalance: bigint;
  totalETHBalance: bigint;
  totalFeesEarnedSUP: bigint;
  totalFeesEarnedETH: bigint;
  earningsRateETH: bigint;
  aprPercentage: number | null;
  positionCount: number;
  lastUpdatedAt: number;
}

function splitPoolAmounts(
  amount0: bigint,
  amount1: bigint,
  isSUPToken0: boolean,
) {
  return isSUPToken0
    ? { supAmount: amount0, ethAmount: amount1 }
    : { supAmount: amount1, ethAmount: amount0 };
}

/** Aggregates the active Uniswap V3 positions owned by a FluidLocker. */
export function useLockerLiquidityBalance(lockerAddress?: Address) {
  const activePositions = useActiveLiquidityPositions(lockerAddress);
  const tokenIds = activePositions.data?.tokenIds ?? [];
  const pool = useEthSupPool();
  const positionReads = useReadContracts({
    contracts: tokenIds.map((tokenId) => ({
      address: NONFUNGIBLE_POSITION_MANAGER_ADDRESS[APP_CHAIN.id],
      abi: nonfungiblePositionManagerAbi,
      functionName: "positions",
      args: [tokenId],
    })),
    query: { enabled: tokenIds.length > 0 && Boolean(pool.sdkPool) },
  });

  const data = useMemo<LockerLiquidityBalance>(() => {
    if (
      !pool.sdkPool ||
      pool.isSUPToken0 === undefined ||
      !positionReads.data ||
      positionReads.data.length === 0
    ) {
      return {
        totalSUPBalance: 0n,
        totalETHBalance: 0n,
        totalFeesEarnedSUP: 0n,
        totalFeesEarnedETH: 0n,
        earningsRateETH: 0n,
        aprPercentage: null,
        positionCount: 0,
        lastUpdatedAt: Math.floor(Date.now() / 1_000),
      };
    }

    let totalSUPBalance = 0n;
    let totalETHBalance = 0n;
    let totalFeesEarnedSUP = 0n;
    let totalFeesEarnedETH = 0n;

    for (const positionRead of positionReads.data as readonly any[]) {
      if (positionRead.status !== "success" || !positionRead.result) continue;
      const positionData = positionRead.result as readonly [
        bigint,
        Address,
        Address,
        Address,
        number,
        number,
        number,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
      ];
      const position = new Position({
        pool: pool.sdkPool,
        liquidity: positionData[7].toString(),
        tickLower: positionData[5],
        tickUpper: positionData[6],
      });
      const balances = splitPoolAmounts(
        parseUnits(position.amount0.toSignificant(18), 18),
        parseUnits(position.amount1.toSignificant(18), 18),
        pool.isSUPToken0,
      );
      const fees = splitPoolAmounts(
        positionData[10],
        positionData[11],
        pool.isSUPToken0,
      );
      totalSUPBalance += balances.supAmount;
      totalETHBalance += balances.ethAmount;
      totalFeesEarnedSUP += fees.supAmount;
      totalFeesEarnedETH += fees.ethAmount;
    }

    return {
      totalSUPBalance,
      totalETHBalance,
      totalFeesEarnedSUP,
      totalFeesEarnedETH,
      earningsRateETH: 0n,
      aprPercentage: null,
      positionCount: tokenIds.length,
      lastUpdatedAt: Math.floor(Date.now() / 1_000),
    };
  }, [pool.isSUPToken0, pool.sdkPool, positionReads.data, tokenIds.length]);

  return { data, isLoading: pool.isLoading || positionReads.isLoading };
}
