"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";
import { useReadCfaForwarder } from "@sfpro/sdk/hook";

import { APP_CHAIN } from "../config/chains";
import { SUP_TOKEN_ADDRESS_BY_CHAIN } from "../contracts/app-contracts";
import { sumReserveFlowRates } from "../lib/reserve-flow";
import { getPublicPrograms } from "../client/programs";
import { useRecentTransactions } from "./useRecentTransactions";
import { useLockerLiquidityBalance } from "./useLockerLiquidityBalance";
import type { Address } from "../types/program-app";

export function useLockerBalance({
  lockerAddress,
}: {
  lockerAddress?: Address;
}) {
  const depositedRecently =
    useRecentTransactions("deposited-in-reserve", 30).length > 0;
  const liquidity = useLockerLiquidityBalance(lockerAddress).data;
  const { data: cfaFlowRate } = useReadCfaForwarder({
    functionName: "getNetFlow",
    chainId: APP_CHAIN.id,
    args: [SUP_TOKEN_ADDRESS_BY_CHAIN[APP_CHAIN.id], lockerAddress],
    query: { enabled: Boolean(lockerAddress) },
  } as never);
  const programs = useQuery({
    queryKey: ["public-programs"],
    queryFn: getPublicPrograms,
  });
  const programIds = (programs.data ?? []).map((program) => BigInt(program.id));
  const programFlowRates = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "getFlowRatePerProgram",
    args: [programIds],
    chainId: APP_CHAIN.id,
    query: {
      enabled: Boolean(lockerAddress && programs.data),
    },
  });
  const flowRate =
    cfaFlowRate === undefined || programFlowRates.data === undefined
      ? undefined
      : sumReserveFlowRates(cfaFlowRate, programFlowRates.data);
  const { data: availableBalance } = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "getAvailableBalance",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(lockerAddress) },
  });
  const { data: stakedBalance } = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "getStakedBalance",
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(lockerAddress) },
  });
  return useQuery({
    queryKey: [
      "locker-balance",
      lockerAddress ?? null,
      flowRate,
      availableBalance,
      stakedBalance,
      liquidity?.totalSUPBalance,
      liquidity?.lastUpdatedAt,
    ],
    queryFn: () => {
      const available = availableBalance ?? 0n;
      const staked = stakedBalance ?? 0n;
      const inLiquidity = liquidity?.totalSUPBalance ?? 0n;
      return {
        totalBalance: available + staked + inLiquidity,
        availableBalance: available,
        stakedBalance: staked,
        liquidityBalance: inLiquidity,
        flowRate: flowRate ?? 0n,
        timestamp: liquidity?.lastUpdatedAt
          ? BigInt(liquidity.lastUpdatedAt)
          : 0n,
        hasTotalBalanceLoaded:
          availableBalance !== undefined &&
          stakedBalance !== undefined &&
          liquidity?.totalSUPBalance !== undefined,
        hasAvailableBalanceLoaded: availableBalance !== undefined,
        hasStakedBalanceLoaded: stakedBalance !== undefined,
        hasLiquidityBalanceLoaded: liquidity?.totalSUPBalance !== undefined,
        hasFlowRateLoaded: flowRate !== undefined,
        hasTimestampLoaded: liquidity?.lastUpdatedAt !== undefined,
        isFullyLoaded:
          availableBalance !== undefined &&
          stakedBalance !== undefined &&
          liquidity?.totalSUPBalance !== undefined &&
          flowRate !== undefined &&
          liquidity?.lastUpdatedAt !== undefined,
      };
    },
    refetchInterval: depositedRecently ? 5_000 : false,
  });
}
