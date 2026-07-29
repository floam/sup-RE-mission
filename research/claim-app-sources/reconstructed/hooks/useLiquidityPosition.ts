"use client";

import { useMemo } from "react";
import { Token } from "@uniswap/sdk-core";
import { Pool, Position } from "@uniswap/v3-sdk";
import { useReadContract, useSimulateContract } from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { APP_CHAIN } from "../config/chains";
import {
  ETH_SUP_POOL_ADDRESS,
  MAX_UINT128,
  NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  nonfungiblePositionManagerAbi,
  uniswapV3PoolAbi,
} from "../contracts/app-contracts";
import type { LiquidityPositionView } from "../types/liquidity";
import type { Address } from "../types/program-app";

/**
 * Reverses the generated wagmi reads and Uniswap SDK calculation in webpack
 * 21246. Both pool assets use 18 decimals in this deployment.
 */
export function useLiquidityPosition(
  tokenId?: bigint,
  lockerAddress?: Address,
) {
  const chainId = APP_CHAIN.id;
  const poolAddress = ETH_SUP_POOL_ADDRESS[chainId];
  const managerAddress = NONFUNGIBLE_POSITION_MANAGER_ADDRESS[chainId];
  const enabled = tokenId !== undefined;
  const position = useReadContract({
    abi: nonfungiblePositionManagerAbi,
    address: managerAddress,
    functionName: "positions",
    args: enabled ? [tokenId] : undefined,
    chainId,
    query: { enabled },
  });
  const slot0 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "slot0",
    chainId,
  });
  const poolLiquidity = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "liquidity",
    chainId,
  });
  const positionLiquidity = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "getPositionLiquidity",
    args: enabled ? [tokenId] : undefined,
    chainId,
    query: { enabled: Boolean(lockerAddress && enabled) },
  } as never);
  const cooldown = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "lpCooldownTimestamps",
    args: enabled ? [tokenId] : undefined,
    chainId,
    query: { enabled: Boolean(lockerAddress && enabled) },
  } as never);
  const taxFreeExit = useReadContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: "taxFreeExitTimestamps",
    args: enabled ? [tokenId] : undefined,
    chainId,
    query: { enabled: Boolean(lockerAddress && enabled) },
  } as never);
  const feeQuote = useSimulateContract({
    abi: nonfungiblePositionManagerAbi,
    address: managerAddress,
    functionName: "collect",
    args:
      enabled && lockerAddress
        ? [
            {
              tokenId,
              recipient: lockerAddress,
              amount0Max: MAX_UINT128,
              amount1Max: MAX_UINT128,
            },
          ]
        : undefined,
    account: lockerAddress,
    chainId,
    stateOverride: lockerAddress
      ? [{ address: lockerAddress, balance: 100_000_000_000_000_000_000n }]
      : undefined,
    query: { enabled: Boolean(enabled && lockerAddress) },
  });

  const data = useMemo<LiquidityPositionView | undefined>(() => {
    if (
      !position.data ||
      !slot0.data ||
      poolLiquidity.data === undefined ||
      tokenId === undefined
    )
      return undefined;
    try {
      const [
        ,
        ,
        token0Address,
        token1Address,
        fee,
        tickLower,
        tickUpper,
        nftLiquidity,
      ] = position.data;
      const token0 = new Token(chainId, token0Address, 18);
      const token1 = new Token(chainId, token1Address, 18);
      const pool = new Pool(
        token0,
        token1,
        fee,
        slot0.data[0].toString(),
        poolLiquidity.data.toString(),
        slot0.data[1],
      );
      const sdkPosition = new Position({
        pool,
        liquidity: nftLiquidity.toString(),
        tickLower,
        tickUpper,
      });
      const amount0 = BigInt(sdkPosition.amount0.quotient.toString());
      const amount1 = BigInt(sdkPosition.amount1.quotient.toString());
      const fees = feeQuote.data?.result ?? [0n, 0n];
      const isSupToken0 =
        token0Address.toLowerCase() ===
        SUP_TOKEN_ADDRESS_BY_CHAIN[chainId].toLowerCase();
      return {
        tokenId,
        liquidity:
          (positionLiquidity.data as bigint | undefined) ?? nftLiquidity,
        amount0,
        amount1,
        supAmount: isSupToken0 ? amount0 : amount1,
        ethAmount: isSupToken0 ? amount1 : amount0,
        feesSUP: isSupToken0 ? fees[0] : fees[1],
        feesETH: isSupToken0 ? fees[1] : fees[0],
        cooldownTimestamp: cooldown.data as bigint | undefined,
        taxFreeExitTimestamp: taxFreeExit.data as bigint | undefined,
      };
    } catch (error) {
      console.error("Error calculating position amounts:", error);
      return undefined;
    }
  }, [
    chainId,
    cooldown.data,
    feeQuote.data?.result,
    poolLiquidity.data,
    position.data,
    positionLiquidity.data,
    slot0.data,
    taxFreeExit.data,
    tokenId,
  ]);

  return {
    data,
    isLoading:
      position.isLoading ||
      slot0.isLoading ||
      poolLiquidity.isLoading ||
      positionLiquidity.isLoading,
    error:
      position.error ??
      slot0.error ??
      poolLiquidity.error ??
      positionLiquidity.error,
    isCooldownExpired: Boolean(
      cooldown.data && Math.floor(Date.now() / 1_000) > Number(cooldown.data),
    ),
    isTaxFreeExpired: Boolean(
      taxFreeExit.data &&
      Math.floor(Date.now() / 1_000) > Number(taxFreeExit.data),
    ),
  };
}

export function useEthSupPool() {
  const chainId = APP_CHAIN.id;
  const poolAddress = ETH_SUP_POOL_ADDRESS[chainId];
  const token0 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "token0",
    chainId,
  });
  const token1 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "token1",
    chainId,
  });
  const fee = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "fee",
    chainId,
  });
  const liquidity = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "liquidity",
    chainId,
  });
  const slot0 = useReadContract({
    abi: uniswapV3PoolAbi,
    address: poolAddress,
    functionName: "slot0",
    chainId,
  });
  return useMemo(() => {
    if (
      !token0.data ||
      !token1.data ||
      fee.data === undefined ||
      liquidity.data === undefined ||
      !slot0.data
    ) {
      return {
        isLoading:
          token0.isLoading ||
          token1.isLoading ||
          fee.isLoading ||
          liquidity.isLoading ||
          slot0.isLoading,
      };
    }
    const sdkToken0 = new Token(chainId, token0.data, 18);
    const sdkToken1 = new Token(chainId, token1.data, 18);
    return {
      sdkToken0,
      sdkToken1,
      sdkPool: new Pool(
        sdkToken0,
        sdkToken1,
        fee.data,
        slot0.data[0].toString(),
        liquidity.data.toString(),
        slot0.data[1],
      ),
      isSUPToken0:
        token0.data.toLowerCase() ===
        SUP_TOKEN_ADDRESS_BY_CHAIN[chainId].toLowerCase(),
      fee: fee.data,
      isLoading: false,
    };
  }, [
    chainId,
    fee.data,
    fee.isLoading,
    liquidity.data,
    liquidity.isLoading,
    slot0.data,
    slot0.isLoading,
    token0.data,
    token0.isLoading,
    token1.data,
    token1.isLoading,
  ]);
}
