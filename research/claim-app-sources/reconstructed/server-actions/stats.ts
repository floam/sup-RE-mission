"use server";

import { unstable_cache } from "next/cache";
import { formatUnits, parseUnits, type Address } from "viem";

import { BASE_CHAIN_ID } from "../config/chains";
import {
  ETH_SUP_POOL_ADDRESS,
  LP_DISTRIBUTION_POOL_ADDRESS,
  SUP_TOKEN_ADDRESS_BY_CHAIN,
  TAX_DISTRIBUTION_POOL_ADDRESS,
  WETH_ADDRESS,
} from "../contracts/app-contracts";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import { queryGraphQL } from "../lib/graphql";
import type {
  LiquidityPoolStats,
  SerializedLiquidityRewardStats,
} from "../types/liquidity";
import type { SerializedStakingStats } from "../types/staking";

interface ProtocolPoolRecord {
  id: Address;
  totalUnits: string;
  totalMembers: number;
  totalAmountDistributedUntilUpdatedAt: string;
  flowRate: string;
  updatedAtTimestamp: string;
}

interface UniswapPoolRecord {
  feeTier: string;
  totalValueLockedToken0: string;
  totalValueLockedToken1: string;
  token0: { id: Address };
  token1: { id: Address };
}

interface UniswapPoolDayRecord {
  date: number;
  volumeToken0: string;
  volumeToken1: string;
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const STAKING_WITHDRAWAL_PERIOD_DAYS = 30;
const METRICS_REVALIDATE_SECONDS = 15 * 60;

const PROTOCOL_POOL_QUERY = /* GraphQL */ `
  query ProtocolPool($id: ID!) {
    pool(id: $id) {
      id
      totalUnits
      totalMembers
      totalAmountDistributedUntilUpdatedAt
      flowRate
      updatedAtTimestamp
    }
  }
`;

const UNISWAP_POOL_QUERY = /* GraphQL */ `
  query LiquidityPool($poolId: ID!, $poolAddress: String!, $date: Int!) {
    pool(id: $poolId) {
      feeTier
      totalValueLockedToken0
      totalValueLockedToken1
      token0 {
        id
      }
      token1 {
        id
      }
    }
    poolDayDatas(first: 1, where: { pool: $poolAddress, date: $date }) {
      date
      volumeToken0
      volumeToken1
    }
  }
`;

async function readProtocolPool(poolAddress: Address) {
  const { pool } = await queryGraphQL<
    { pool: ProtocolPoolRecord | null },
    { id: string }
  >(
    EXTERNAL_ENDPOINTS.baseProtocolSubgraph,
    PROTOCOL_POOL_QUERY,
    { id: poolAddress.toLowerCase() },
    { cache: "no-store" },
  );
  if (!pool) throw new Error(`Protocol pool ${poolAddress} was not found`);
  return pool;
}

function calculateCurrentDistributedAmount(
  pool: ProtocolPoolRecord,
  timestamp: number,
) {
  const updatedAt = BigInt(pool.updatedAtTimestamp);
  const elapsed =
    BigInt(timestamp) > updatedAt ? BigInt(timestamp) - updatedAt : 0n;
  return (
    BigInt(pool.totalAmountDistributedUntilUpdatedAt) +
    BigInt(pool.flowRate) * elapsed
  );
}

function roundPercentage(value: number) {
  return Math.round(value * 10) / 10;
}

function calculateTokenApr(flowRate: bigint, principal: bigint) {
  if (principal === 0n) return 0;
  const annualRewards = Number(formatUnits(flowRate, 18)) * SECONDS_PER_YEAR;
  return roundPercentage(
    (annualRewards / Number(formatUnits(principal, 18))) * 100,
  );
}

/** Reconstructed body for action 00a6446d221d62d46ca41e7294731c14ab30fc9053. */
export async function getStakingStats(): Promise<SerializedStakingStats> {
  const taxDistributionPool = TAX_DISTRIBUTION_POOL_ADDRESS[BASE_CHAIN_ID];
  const pool = await readProtocolPool(taxDistributionPool);
  const timestamp = Math.floor(Date.now() / 1_000);
  const totalStaked = BigInt(pool.totalUnits) * 10n ** 18n;
  const totalDistributedFlowRate = BigInt(pool.flowRate);

  return {
    totalStaked: totalStaked.toString(),
    totalDistributed: calculateCurrentDistributedAmount(
      pool,
      timestamp,
    ).toString(),
    totalDistributedFlowRate: totalDistributedFlowRate.toString(),
    totalDistributedTimestamp: timestamp,
    apr: calculateTokenApr(totalDistributedFlowRate, totalStaked),
    bonusApr: 0,
    withdrawalPeriodDays: STAKING_WITHDRAWAL_PERIOD_DAYS,
    totalStakers: pool.totalMembers,
    lastUpdatedAt: Math.floor(Date.now() / 1_000),
    taxDistributionPool,
  };
}

async function loadLiquidityPoolStats(): Promise<LiquidityPoolStats> {
  const timestamp = Math.floor(Date.now() / 1_000);
  const date = Math.floor(timestamp / 86_400) * 86_400;
  const poolAddress = ETH_SUP_POOL_ADDRESS[BASE_CHAIN_ID].toLowerCase();
  const { pool, poolDayDatas } = await queryGraphQL<
    {
      pool: UniswapPoolRecord | null;
      poolDayDatas: UniswapPoolDayRecord[];
    },
    { poolId: string; poolAddress: string; date: number }
  >(
    EXTERNAL_ENDPOINTS.uniswapV3BaseSubgraph,
    UNISWAP_POOL_QUERY,
    { poolId: poolAddress, poolAddress, date },
    { cache: "no-store" },
  );
  if (!pool) throw new Error(`Uniswap pool ${poolAddress} was not found`);
  const daily = poolDayDatas[0];

  return {
    totalValueLockedToken0: pool.totalValueLockedToken0,
    totalValueLockedToken1: pool.totalValueLockedToken1,
    volumeToken0: daily?.volumeToken0 ?? "0",
    volumeToken1: daily?.volumeToken1 ?? "0",
    feeTier: pool.feeTier,
    token0Address: pool.token0.id.toLowerCase() as Address,
    token1Address: pool.token1.id.toLowerCase() as Address,
    date: daily?.date ?? date,
    lastUpdatedAt: timestamp,
  };
}

const readCachedLiquidityPoolStats = unstable_cache(
  loadLiquidityPoolStats,
  ["liquidity-pool-metrics"],
  { revalidate: METRICS_REVALIDATE_SECONDS },
);

/** Reconstructed body for action 00c1274b3226ccdf16c1f187bbdd66ac7c5647b0ae. */
export async function getLiquidityPoolStats(): Promise<LiquidityPoolStats> {
  return readCachedLiquidityPoolStats();
}

async function readLiFiTokenPrice(tokenAddress: Address) {
  const response = await fetch(
    `${EXTERNAL_ENDPOINTS.liFiBase}/token?chain=${BASE_CHAIN_ID}&token=${tokenAddress}`,
    { next: { revalidate: 5 * 60 } } as RequestInit & {
      next: { revalidate: number };
    },
  );
  if (!response.ok) throw new Error("Failed to fetch token price");
  const token = (await response.json()) as { priceUSD: string };
  return Number(token.priceUSD);
}

/** The action output consistently truncates subgraph dust after 12 decimals. */
function parseSubgraphTokenAmount(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return parseUnits(`${whole}.${fraction.slice(0, 12)}`, 18);
}

async function loadLiquidityRewardsStats(): Promise<SerializedLiquidityRewardStats> {
  const lpDistributionPool = LP_DISTRIBUTION_POOL_ADDRESS[BASE_CHAIN_ID];
  const [poolStats, rewardsPool, ethPriceUSD, supPriceUSD] = await Promise.all([
    getLiquidityPoolStats(),
    readProtocolPool(lpDistributionPool),
    readLiFiTokenPrice(WETH_ADDRESS[BASE_CHAIN_ID]),
    readLiFiTokenPrice(SUP_TOKEN_ADDRESS_BY_CHAIN[BASE_CHAIN_ID]),
  ]);
  const timestamp = Math.floor(Date.now() / 1_000);
  const supAddress = SUP_TOKEN_ADDRESS_BY_CHAIN[BASE_CHAIN_ID].toLowerCase();
  const isSupToken0 = poolStats.token0Address.toLowerCase() === supAddress;
  const supLiquidity = isSupToken0
    ? poolStats.totalValueLockedToken0
    : poolStats.totalValueLockedToken1;
  const token0Price = isSupToken0 ? supPriceUSD : ethPriceUSD;
  const token1Price = isSupToken0 ? ethPriceUSD : supPriceUSD;
  const totalValueLockedUSD =
    Number(poolStats.totalValueLockedToken0) * token0Price +
    Number(poolStats.totalValueLockedToken1) * token1Price;
  const totalDistributedFlowRate = BigInt(rewardsPool.flowRate);
  const annualRewardsUSD =
    Number(formatUnits(totalDistributedFlowRate, 18)) *
    SECONDS_PER_YEAR *
    supPriceUSD;

  return {
    totalLiquidity: parseSubgraphTokenAmount(supLiquidity).toString(),
    totalDistributed: calculateCurrentDistributedAmount(
      rewardsPool,
      timestamp,
    ).toString(),
    totalDistributedFlowRate: totalDistributedFlowRate.toString(),
    totalDistributedTimestamp: timestamp,
    apr:
      totalValueLockedUSD === 0
        ? 0
        : roundPercentage((annualRewardsUSD / totalValueLockedUSD) * 100),
    bonusApr: 0,
    totalLPs: rewardsPool.totalMembers,
    lastUpdatedAt: poolStats.lastUpdatedAt,
    lpDistributionPool,
  };
}

const readCachedLiquidityRewardsStats = unstable_cache(
  loadLiquidityRewardsStats,
  ["liquidity-rewards-stats"],
  { revalidate: METRICS_REVALIDATE_SECONDS },
);

/** Reconstructed body for action 0099a827feb87232328ca49a8aaec8daa5598e5c0c. */
export async function getLiquidityRewardsStats(): Promise<SerializedLiquidityRewardStats> {
  return readCachedLiquidityRewardsStats();
}

/** Reconstructed body for action 00cfeebe90442ab515b51fba3ba323324474e768b8. */
export async function getTotalDelegatedAmount(): Promise<number> {
  const response = await fetch(
    `${EXTERNAL_ENDPOINTS.supMetrics}/v1/total_delegated_score`,
    {
      next: { revalidate: METRICS_REVALIDATE_SECONDS },
    } as RequestInit & { next: { revalidate: number } },
  );
  if (!response.ok) throw new Error("Failed to fetch delegated voting power");
  const result = (await response.json()) as { totalDelegatedScore: number };
  return result.totalDelegatedScore;
}
