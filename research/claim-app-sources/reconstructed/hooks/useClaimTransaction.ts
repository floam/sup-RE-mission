"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import superjson from "superjson";
import { encodeFunctionData, parseEther } from "viem";
import {
  useEstimateGas,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { lockerAbi } from "@sfpro/sdk/abi/sup";

import { useExpectedChains } from "../contexts/ExpectedChainContext";
import { API_ENDPOINTS } from "../lib/endpoints";
import { EXTERNAL_ENDPOINTS } from "../lib/endpoints";
import type { Address } from "../types/program-app";
import type {
  ClaimTransaction,
  ProgramPointState,
} from "../types/transactions";
import { useProgramApps } from "./useProgramApps";
import {
  getTransactionStatus,
  useLogTransactionErrors,
} from "./useTransactionStatus";

export interface PointStateResponse {
  accountAddress: Address;
  lockerAddress?: Address;
  programPointStates: ProgramPointState[];
  canClaim: boolean;
}

export interface ClaimResponse {
  canClaim: boolean;
  claimTransaction?: ClaimTransaction;
}

export interface ClaimCall {
  canClaim: boolean;
  functionName?:
    | "claim"
    | "claimAndStake"
    | "disconnectAndClaim"
    | "disconnectAndClaimAndStake";
  args?: readonly unknown[];
}

async function readSuperJson<T>(url: string, errorMessage: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(errorMessage);
  return superjson.parse<T>(await response.text());
}

export function useAccountProgramPointStates(
  accountAddress?: Address,
  enabled = true,
) {
  return useQuery<PointStateResponse>({
    queryKey: ["getAccountProgramPointStates", accountAddress],
    enabled: enabled && Boolean(accountAddress),
    queryFn: () =>
      readSuperJson(
        API_ENDPOINTS.pointStates(accountAddress!),
        "Failed to fetch account program point states",
      ),
  });
}

export function useAccountPointClaim(input: {
  accountAddress?: Address;
  enabled: boolean;
  canClaim: boolean;
  isFinished: boolean;
  isLoadingProgramPools: boolean;
  isLoadingProgramApps: boolean;
}) {
  const enabled =
    input.enabled &&
    Boolean(input.accountAddress) &&
    input.canClaim &&
    !input.isFinished &&
    !input.isLoadingProgramPools &&
    !input.isLoadingProgramApps;
  return useQuery<ClaimResponse>({
    queryKey: ["getAccountPointClaim", input.accountAddress],
    enabled,
    queryFn: () =>
      readSuperJson(
        API_ENDPOINTS.pointClaim(input.accountAddress!),
        "Failed to fetch account point claim",
      ),
  });
}

/** Exact FluidLocker method selection and argument ordering from the claim bundle. */
export function buildClaimCall(
  claim: ClaimResponse | undefined,
  finishedProgramIds: readonly bigint[] | undefined,
  withStake: boolean,
): ClaimCall {
  const transaction = claim?.claimTransaction;
  if (!claim?.canClaim || !transaction) return { canClaim: false };
  const disconnect = Boolean(finishedProgramIds?.length);
  const functionName = disconnect
    ? withStake
      ? "disconnectAndClaimAndStake"
      : "disconnectAndClaim"
    : withStake
      ? "claimAndStake"
      : "claim";

  if (transaction.type === "single") {
    const voucher = [
      transaction.programId,
      transaction.totalProgramUnits,
      transaction.nonce,
      transaction.stackSignature,
    ] as const;
    return {
      canClaim: true,
      functionName,
      args: disconnect
        ? [
            finishedProgramIds!,
            [transaction.programId],
            [transaction.totalProgramUnits],
            transaction.nonce,
            transaction.stackSignature,
          ]
        : voucher,
    };
  }

  const voucher = [
    transaction.programIds,
    transaction.totalProgramUnits,
    transaction.nonce,
    transaction.stackSignature,
  ] as const;
  return {
    canClaim: true,
    functionName,
    args: disconnect ? [finishedProgramIds!, ...voucher] : voucher,
  };
}

const FINISHED_POOLS_QUERY = `
  query GetInactivePoolsMemberIsConnectedTo($account: String!, $pool_in: [String!]!) {
    poolMembers(first: 1000, where: { account: $account, pool_in: $pool_in, isConnected: true }) {
      pool { id }
    }
  }
`;

async function getConnectedFinishedProgramIds({
  lockerAddress,
  finishedPrograms,
  subgraphUrl,
}: {
  lockerAddress: Address;
  finishedPrograms: readonly { id: string; poolAddress: Address }[];
  subgraphUrl: string;
}) {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: FINISHED_POOLS_QUERY,
      variables: {
        account: lockerAddress.toLowerCase(),
        pool_in: finishedPrograms.map((program) =>
          program.poolAddress.toLowerCase(),
        ),
      },
    }),
  });
  if (!response.ok)
    throw new Error("Failed to fetch inactive pool connections");
  const body = (await response.json()) as {
    data?: { poolMembers?: { pool: { id: string } }[] };
    errors?: unknown;
  };
  if (body.errors)
    throw new Error("Failed to query inactive pool connections", {
      cause: body.errors,
    });
  const connectedPools = new Set(
    (body.data?.poolMembers ?? []).map((member) =>
      member.pool.id.toLowerCase(),
    ),
  );
  return finishedPrograms
    .filter((program) => connectedPools.has(program.poolAddress.toLowerCase()))
    .map((program) => BigInt(program.id));
}

export function useClaimTransaction({
  accountAddress,
  lockerAddress,
  withStake = false,
  enabled = true,
}: {
  accountAddress?: Address;
  lockerAddress?: Address;
  withStake?: boolean;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { airdropChain } = useExpectedChains();
  const writeLockerClaim = useWriteContract();
  const waitForTransactionClaim = useWaitForTransactionReceipt({
    chainId: airdropChain.id,
    hash: writeLockerClaim.data,
    query: { enabled: enabled && Boolean(writeLockerClaim.data) },
  });
  const isFinished =
    writeLockerClaim.isSuccess && waitForTransactionClaim.isSuccess;
  const programApps = useProgramApps(enabled);
  const finishedPrograms = useMemo(
    () =>
      (programApps.data ?? [])
        .filter(
          (app) =>
            app.program?.onchainInfo.isFundingFinished &&
            app.program.onchainInfo.poolAddress,
        )
        .map((app) => ({
          id: app.program!.id,
          poolAddress: app.program!.onchainInfo.poolAddress!,
        })),
    [programApps.data],
  );
  const subgraphUrl =
    airdropChain.id === 84532
      ? EXTERNAL_ENDPOINTS.baseSepoliaProtocolSubgraph
      : EXTERNAL_ENDPOINTS.baseProtocolSubgraph;
  const finishedProgramIds = useQuery({
    queryKey: [lockerAddress ?? null, "finished-program-pools-with-connection"],
    enabled: enabled && Boolean(lockerAddress && finishedPrograms.length),
    queryFn: () =>
      getConnectedFinishedProgramIds({
        lockerAddress: lockerAddress!,
        finishedPrograms,
        subgraphUrl,
      }),
  });
  const readAccountProgramPointStates = useAccountProgramPointStates(
    accountAddress,
    enabled,
  );
  const readAccountPointClaim = useAccountPointClaim({
    accountAddress,
    enabled,
    canClaim: Boolean(readAccountProgramPointStates.data?.canClaim),
    isFinished,
    isLoadingProgramPools: finishedProgramIds.isLoading,
    isLoadingProgramApps: programApps.isLoading,
  });
  const claimTransactionData = useMemo(
    () =>
      buildClaimCall(
        readAccountPointClaim.data,
        finishedProgramIds.data,
        withStake,
      ),
    [finishedProgramIds.data, readAccountPointClaim.data, withStake],
  );
  const canSimulate = Boolean(
    enabled &&
      lockerAddress &&
      readAccountProgramPointStates.data?.canClaim &&
      claimTransactionData.args &&
      !isFinished,
  );
  const stateOverride = accountAddress
    ? [{ address: accountAddress, balance: parseEther("100") }]
    : undefined;
  const simulateLockerClaim = useSimulateContract({
    abi: lockerAbi,
    address: lockerAddress,
    functionName: claimTransactionData.functionName,
    chainId: airdropChain.id,
    args: claimTransactionData.args as never,
    query: { enabled: canSimulate },
    stateOverride,
  } as never);
  const request = simulateLockerClaim.data?.request;
  const estimateLockerClaim = useEstimateGas({
    chainId: airdropChain.id,
    to: request?.address,
    data: request
      ? encodeFunctionData({
          abi: lockerAbi,
          functionName: claimTransactionData.functionName!,
          args: claimTransactionData.args as never,
        } as never)
      : undefined,
    query: {
      select: (gas) => (120n * gas) / 100n,
      enabled: Boolean(request && canSimulate && !isFinished),
    },
    stateOverride,
  });

  useEffect(() => {
    if (!isFinished) return;
    void queryClient.invalidateQueries({
      queryKey: ["locker-balance", lockerAddress],
    });
    void queryClient.invalidateQueries({ queryKey: ["programPoolInfos"] });
    void queryClient.invalidateQueries({
      queryKey: ["getAccountProgramPointStates", accountAddress],
    });
    if (readAccountProgramPointStates.data) {
      const updated: PointStateResponse = {
        ...readAccountProgramPointStates.data,
        canClaim: false,
        programPointStates:
          readAccountProgramPointStates.data.programPointStates.map(
            (state) => ({
              ...state,
              onchainPoints: state.offchainPoints,
            }),
          ),
      };
      queryClient.setQueryData(
        ["getAccountProgramPointStates", accountAddress],
        updated,
      );
      queryClient.setQueryData(["getAccountPointClaim", accountAddress], {
        canClaim: false,
      });
    }
  }, [
    accountAddress,
    isFinished,
    lockerAddress,
    queryClient,
    readAccountProgramPointStates.data,
  ]);

  const claim = useCallback(() => {
    if (!request) {
      if (simulateLockerClaim.error) console.error(simulateLockerClaim.error);
      console.error("Error! No transaction simulation data available.");
      return;
    }
    writeLockerClaim.writeContract({
      ...request,
      gas: estimateLockerClaim.data,
    });
  }, [
    estimateLockerClaim.data,
    request,
    simulateLockerClaim.error,
    writeLockerClaim,
  ]);
  useLogTransactionErrors([
    simulateLockerClaim,
    estimateLockerClaim,
    writeLockerClaim,
    waitForTransactionClaim,
  ]);

  return {
    readAccountProgramPointStates,
    readAccountPointClaim,
    claimTransactionData,
    writeLockerClaim,
    waitForTransactionClaim,
    isFinished,
    claim,
    status: getTransactionStatus({
      simulate: simulateLockerClaim,
      estimate: estimateLockerClaim,
      write: writeLockerClaim,
      waitFor: waitForTransactionClaim,
    }),
  };
}
