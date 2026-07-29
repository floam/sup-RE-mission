import {
  lockerAbi,
  lockerFactoryAbi,
  lockerFactoryAddress,
} from "@sfpro/sdk/abi/sup";
import { readContract, type Config } from "@wagmi/core";
import { getAddress, type Address } from "viem";
import { base } from "viem/chains";

import { ZERO_ADDRESS, gdaPoolReadAbi } from "../contracts/app-contracts";
import { cmsClient, requireCmsData } from "../lib/cms-client";
import { validateCmsCampaignBatch } from "./claim-batch";
import { buildClaimProgramPlan } from "./claim-program-plan";
import { isClaimablePointState } from "./claim-state";
import { projectMemberFlowRate } from "./flow-projection";
import { getPublicPrograms } from "./programs";

export interface PointState {
  programId: bigint;
  offchainPoints: bigint;
  uncappedPoints: bigint;
  onchainPoints: bigint;
  currentFlowRate: bigint;
  projectedFlowRate: bigint;
  isOnchainOutdated: boolean;
  isCapped: boolean;
  cmsCampaignExists: boolean;
}

export interface ClaimState {
  account: Address;
  lockerAddress: Address;
  lockerCreated: boolean;
  canClaim: boolean;
  programPointStates: PointState[];
}

interface ProgramChainState {
  units: bigint;
  currentFlowRate: bigint;
  totalUnits: bigint;
  totalFlowRate: bigint;
}

export async function buildClaimState(
  config: Config,
  account: Address,
): Promise<ClaimState> {
  const programs = await getPublicPrograms();
  if (programs.length === 0) {
    throw new Error(
      "The SUP subgraph returned no programs, so campaign allocations could not be verified.",
    );
  }
  const plan = buildClaimProgramPlan(programs);

  const [lockerCreated, lockerAddress] = await readContract(config, {
    authorizationList: undefined,
    address: lockerFactoryAddress[base.id],
    abi: lockerFactoryAbi,
    chainId: base.id,
    functionName: "getUserLocker",
    args: [account],
  });

  const balances = await Promise.all(
    plan.cmsBatches.map(async (campaignIds) => {
      const result = await cmsClient.POST("/points/balance-batch", {
        body: { account, campaignIds },
      });
      return requireCmsData("/points/balance-batch", result);
    }),
  );

  const uncappedByProgram = new Map<number, bigint>();
  const cappedByProgram = new Map<number, bigint>();
  const cmsMissingPrograms = new Set<number>();
  for (const [batchIndex, balance] of balances.entries()) {
    const requestedIds = plan.cmsBatches[batchIndex] ?? [];
    validateCmsCampaignBatch({
      label: "CMS balance batch",
      expectedAccount: account,
      expectedCampaignIds: requestedIds,
      responseAccount: balance.address,
      campaignIds: balance.campaignIds,
      pointArrays: [balance.points, balance.cappedPoints],
    });

    balance.campaignIds.forEach((id, index) => {
      uncappedByProgram.set(id, BigInt(balance.points[index]));
      cappedByProgram.set(id, BigInt(balance.cappedPoints[index]));
    });
    for (const warning of balance.warnings ?? []) {
      if (warning.message === "Campaign not found") {
        cmsMissingPrograms.add(warning.campaignId);
      }
    }
  }

  const normalizedLocker = getAddress(lockerAddress);
  const chainStateByProgram = new Map<number, ProgramChainState>();
  if (lockerCreated && normalizedLocker !== ZERO_ADDRESS) {
    const chainStates = await Promise.all(
      plan.comparablePrograms.map(async (program) => {
        const pool = getAddress(program.distributionPool);
        const programId = BigInt(program.id);
        const [units, currentFlowRate, totalUnits, totalFlowRate] =
          await Promise.all([
            readContract(config, {
              authorizationList: undefined,
              address: normalizedLocker,
              abi: lockerAbi,
              chainId: base.id,
              functionName: "getUnitsPerProgram",
              args: [programId],
            }),
            readContract(config, {
              authorizationList: undefined,
              address: normalizedLocker,
              abi: lockerAbi,
              chainId: base.id,
              functionName: "getFlowRatePerProgram",
              args: [programId],
            }),
            readContract(config, {
              authorizationList: undefined,
              address: pool,
              abi: gdaPoolReadAbi,
              chainId: base.id,
              functionName: "getTotalUnits",
            }),
            readContract(config, {
              authorizationList: undefined,
              address: pool,
              abi: gdaPoolReadAbi,
              chainId: base.id,
              functionName: "getTotalFlowRate",
            }),
          ]);
        return {
          programId: Number(program.id),
          units,
          currentFlowRate,
          totalUnits,
          totalFlowRate,
        };
      }),
    );

    for (const state of chainStates) {
      chainStateByProgram.set(state.programId, state);
    }
  }

  const programPointStates = plan.comparablePrograms.map((program) => {
    const programId = Number(program.id);
    const uncappedPoints = uncappedByProgram.get(programId) ?? 0n;
    const offchainPoints = cappedByProgram.get(programId) ?? 0n;
    const chainState = chainStateByProgram.get(programId);
    const onchainPoints = chainState?.units ?? 0n;
    const currentFlowRate = chainState?.currentFlowRate ?? 0n;
    const projectedFlowRate = chainState
      ? projectMemberFlowRate({
          currentUnits: onchainPoints,
          targetUnits: offchainPoints,
          totalUnits: chainState.totalUnits,
          totalFlowRate: chainState.totalFlowRate,
        })
      : 0n;

    return {
      programId: BigInt(programId),
      offchainPoints,
      uncappedPoints,
      onchainPoints,
      currentFlowRate,
      projectedFlowRate,
      isOnchainOutdated: offchainPoints !== onchainPoints,
      isCapped: uncappedPoints !== offchainPoints,
      cmsCampaignExists: !cmsMissingPrograms.has(programId),
    };
  });

  return {
    account,
    lockerAddress: normalizedLocker,
    lockerCreated,
    canClaim:
      lockerCreated &&
      normalizedLocker !== ZERO_ADDRESS &&
      programPointStates.some(isClaimablePointState),
    programPointStates,
  };
}
