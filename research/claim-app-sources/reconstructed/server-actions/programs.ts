"use server";

import { programManagerAbi } from "@sfpro/sdk/abi/sup";
import { createPublicClient, getAddress, http, type Address } from "viem";
import { base } from "viem/chains";

import { BASE_CHAIN_ID } from "../config/chains";
import { ALCHEMY_RPC_URLS } from "../config/rpc";
import { PROGRAM_MANAGER_ADDRESS } from "../contracts/app-contracts";
import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import { queryGraphQL } from "../lib/graphql";
import type {
  ProgramApp,
  ProgramOnchainInfo,
  ProgramPoolInfo,
} from "../types/program-app";

interface ProgramSubgraphRecord {
  id: string;
  distributionPool: Address;
}

interface ProtocolPoolRecord {
  id: Address;
  totalUnits: string;
  totalMembers: number;
  totalAmountDistributedUntilUpdatedAt: string;
  perUnitFlowRate: string;
  updatedAtTimestamp: string;
}

interface ProgramDetails {
  fundingFlowRate: bigint;
  subsidyFlowRate: bigint;
  fundingStartDate: number;
  duration: number;
}

const PROGRAM_POOLS_QUERY = /* GraphQL */ `
  query ProgramPools($ids: [String!]!) {
    programs(first: 1000, where: { id_in: $ids }) {
      id
      distributionPool
    }
  }
`;

const PROTOCOL_POOLS_QUERY = /* GraphQL */ `
  query ProgramPoolMetrics($ids: [ID!]!) {
    pools(first: 1000, where: { id_in: $ids }) {
      id
      totalUnits
      totalMembers
      totalAmountDistributedUntilUpdatedAt
      perUnitFlowRate
      updatedAtTimestamp
    }
  }
`;

const baseClient = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_RPC_URLS[BASE_CHAIN_ID]),
});

async function loadProgramRuntimeData() {
  const programIds = [
    ...new Set(
      PROGRAM_APP_DEFINITIONS.flatMap(({ program }) =>
        program ? [program.id] : [],
      ),
    ),
  ];

  const [programDetails, programSubgraphData] = await Promise.all([
    baseClient.multicall({
      authorizationList: undefined,
      allowFailure: false,
      contracts: programIds.map(
        (programId) =>
          ({
            address: PROGRAM_MANAGER_ADDRESS[BASE_CHAIN_ID],
            abi: programManagerAbi,
            functionName: "getProgramDetails",
            args: [BigInt(programId)],
          }) as const,
      ),
    }),
    queryGraphQL<{ programs: ProgramSubgraphRecord[] }, { ids: string[] }>(
      EXTERNAL_ENDPOINTS.supSubgraph,
      PROGRAM_POOLS_QUERY,
      { ids: programIds.map(String) },
      { cache: "no-store" },
    ),
  ]);

  const programRecords = new Map(
    programSubgraphData.programs.map((program) => [
      Number(program.id),
      program,
    ]),
  );
  const poolIds = programSubgraphData.programs.map(({ distributionPool }) =>
    distributionPool.toLowerCase(),
  );
  const { pools } = await queryGraphQL<
    { pools: ProtocolPoolRecord[] },
    { ids: string[] }
  >(
    EXTERNAL_ENDPOINTS.baseProtocolSubgraph,
    PROTOCOL_POOLS_QUERY,
    { ids: poolIds },
    { cache: "no-store" },
  );
  const protocolPools = new Map(
    pools.map((pool) => [pool.id.toLowerCase(), pool]),
  );
  const detailsByProgramId = new Map(
    programIds.map((programId, index) => [programId, programDetails[index]]),
  );

  return { programRecords, protocolPools, detailsByProgramId };
}

function buildProgramOnchainInfo(
  details: ProgramDetails,
  pool: ProtocolPoolRecord,
  now: number,
): ProgramOnchainInfo {
  const { fundingFlowRate, subsidyFlowRate } = details;
  const fundingStartDate = BigInt(details.fundingStartDate);
  const programDuration = BigInt(details.duration);
  const fundingEndDate = fundingStartDate + programDuration;
  const poolUpdatedAt = BigInt(pool.updatedAtTimestamp);
  const elapsedSincePoolUpdate =
    BigInt(now) > poolUpdatedAt ? BigInt(now) - poolUpdatedAt : 0n;
  // The action accrues with the manager's scheduled rate, avoiding pool-unit
  // rounding drift in the protocol subgraph's aggregate `flowRate`.
  const scheduledFlowRate = fundingFlowRate + subsidyFlowRate;
  const totalClaimed =
    BigInt(pool.totalAmountDistributedUntilUpdatedAt) +
    scheduledFlowRate * elapsedSincePoolUpdate;
  const scheduledAllocation = scheduledFlowRate * programDuration;
  const hasHistoricalDistribution = totalClaimed > 0n;

  return {
    poolAddress: getAddress(pool.id),
    fundingFlowRate,
    subsidyFlowRate,
    fundingStartDate,
    fundingEndDate,
    programDuration,
    totalAllocated:
      scheduledAllocation === 0n ? totalClaimed : scheduledAllocation,
    totalClaimed,
    totalClaimedTimestamp: now,
    totalMembers: pool.totalMembers,
    isFundingStarted:
      fundingStartDate === 0n
        ? hasHistoricalDistribution
        : BigInt(now) >= fundingStartDate,
    isFundingFinished:
      fundingEndDate === 0n
        ? hasHistoricalDistribution
        : BigInt(now) >= fundingEndDate,
  };
}

/** Reconstructed body for action 0050c3f0d604f9162ceb3faa2d83005031b4be6b5f. */
export async function getProgramApps(): Promise<ProgramApp[]> {
  const { programRecords, protocolPools, detailsByProgramId } =
    await loadProgramRuntimeData();
  const now = Math.floor(Date.now() / 1_000);

  return PROGRAM_APP_DEFINITIONS.map(({ program, ...definition }) => {
    if (!program) return definition;

    const programId = program.id;
    const programRecord = programRecords.get(programId);
    const details = detailsByProgramId.get(programId);
    const pool = programRecord
      ? protocolPools.get(programRecord.distributionPool.toLowerCase())
      : undefined;
    if (!programRecord || !details || !pool) {
      throw new Error(`Missing runtime data for program ${programId}`);
    }

    return {
      ...definition,
      program: {
        ...program,
        onchainInfo: buildProgramOnchainInfo(details, pool, now),
      },
    };
  });
}

/** Reconstructed body for action 003f4c4ef5e976bf16920f03d8a97174f1d8ae67e6. */
export async function getProgramPoolInfos(): Promise<ProgramPoolInfo[]> {
  const apps = await getProgramApps();
  const activePrograms = apps.flatMap((app) =>
    app.program && !app.isExpired && !app.program.onchainInfo.isFundingFinished
      ? [app.program]
      : [],
  );
  const { pools } = await queryGraphQL<
    { pools: ProtocolPoolRecord[] },
    { ids: string[] }
  >(
    EXTERNAL_ENDPOINTS.baseProtocolSubgraph,
    PROTOCOL_POOLS_QUERY,
    {
      ids: activePrograms.map(({ onchainInfo }) =>
        onchainInfo.poolAddress.toLowerCase(),
      ),
    },
    { cache: "no-store" },
  );
  const poolByAddress = new Map(
    pools.map((pool) => [pool.id.toLowerCase(), pool]),
  );

  return activePrograms.map(({ id, onchainInfo }) => {
    const pool = poolByAddress.get(onchainInfo.poolAddress.toLowerCase());
    if (!pool) throw new Error(`Missing protocol pool for program ${id}`);
    const totalUnits = BigInt(pool.totalUnits);
    const flowRatePerUnit = BigInt(pool.perUnitFlowRate);
    return {
      poolAddress: pool.id.toLowerCase() as Address,
      programId: BigInt(id),
      totalFlowRate: flowRatePerUnit * totalUnits,
      totalUnits,
      flowRatePerUnit,
    };
  });
}
