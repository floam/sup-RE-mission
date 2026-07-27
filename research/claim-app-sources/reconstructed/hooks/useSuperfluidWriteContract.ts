"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getPublicClient,
  simulateContract,
  writeContract as coreWriteContract,
} from "@wagmi/core";
import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Hex,
} from "viem";
import { useAccount, useConfig } from "wagmi";

import type { ClearMacroAction } from "../clearMacro/dashboardClearMacro";
import {
  ClearMacroInsufficientFeeError,
  ClearMacroNotEligibleError,
  executeClearMacro,
  type ClearMacroPhase,
} from "../clearMacro/executeClearMacro";
import { getDashboardClearMacroAddress } from "../clearMacro/networks";
import { ClearMacroRelayError } from "../clearMacro/relayApi";
import {
  forgetClearMacroExecution,
  rememberClearMacroExecution,
} from "../clearMacro/recovery";

export type WriteMutability = "payable" | "nonpayable";

type PayableFunctionName<TAbi extends Abi> = Extract<
  TAbi[number],
  { type: "function"; stateMutability: "payable" }
>["name"];

export interface SuperfluidWriteArgs<
  TAbi extends Abi = Abi,
  TFunctionName extends ContractFunctionName<
    TAbi,
    WriteMutability
  > = ContractFunctionName<TAbi, WriteMutability>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    WriteMutability,
    TFunctionName
  > = ContractFunctionArgs<TAbi, WriteMutability, TFunctionName>,
> {
  chainId: number;
  abi: TAbi;
  address: Address;
  functionName: TFunctionName;
  args: TArgs;
  account?: Address;
  value?: Abi extends TAbi
    ? bigint
    : TFunctionName extends PayableFunctionName<TAbi>
      ? bigint
      : never;
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  clearMacro?: ClearMacroAction;
  clearMacroRequired?: boolean;
}

export type SuperfluidWriteArgsBuilder = () =>
  | SuperfluidWriteArgs
  | Promise<SuperfluidWriteArgs>;

type CoreWriteRequest = Parameters<typeof coreWriteContract>[1];
type CompatibleWriteRequest = CoreWriteRequest & {
  clearMacro?: ClearMacroAction;
  clearMacroRequired?: boolean;
};

interface WriteOutcome {
  hash: Hex;
  chainId: number;
  relayed: boolean;
  executionId?: string;
}

function normalizeRequest(
  request: CompatibleWriteRequest,
  connectedAddress?: Address,
): SuperfluidWriteArgs {
  const source = request as CompatibleWriteRequest & {
    chain?: { id?: number };
    account?: Address | { address: Address };
    args?: readonly unknown[];
  };
  const account =
    typeof source.account === "string"
      ? source.account
      : source.account?.address ?? connectedAddress;
  const chainId = source.chainId ?? source.chain?.id;
  if (!chainId) throw new Error("The transaction request has no chain ID.");
  if (!account) throw new Error("No connected account.");
  return {
    ...(request as unknown as SuperfluidWriteArgs),
    chainId,
    account,
    args: (source.args ?? []) as never,
  };
}

/**
 * Shared Dashboard-style write executor. Feature hooks may pass a typed builder so
 * preflight work is covered by the mutation lifecycle. Existing reconstructed hooks
 * use the compatibility aliases while they retain their simulation/receipt shape.
 */
export function useSuperfluidWriteContract() {
  const config = useConfig();
  const { address: connectedAddress } = useAccount();
  const [relayPhase, setRelayPhase] = useState<ClearMacroPhase>();
  const [relayStatusUnknown, setRelayStatusUnknown] = useState<{
    executionId: string;
  }>();

  const mutation = useMutation<
    WriteOutcome,
    Error,
    SuperfluidWriteArgs | SuperfluidWriteArgsBuilder
  >({
    onMutate: () => {
      setRelayPhase(undefined);
      setRelayStatusUnknown(undefined);
    },
    mutationFn: async (argsOrBuilder) => {
      const params =
        typeof argsOrBuilder === "function"
          ? await argsOrBuilder()
          : argsOrBuilder;
      const account = params.account ?? connectedAddress;
      if (!account) throw new Error("No connected account.");

      const request = {
        chainId: params.chainId,
        abi: params.abi,
        address: params.address,
        functionName: params.functionName,
        args: params.args,
        account,
        ...(params.value !== undefined ? { value: params.value } : {}),
        ...(params.gas !== undefined ? { gas: params.gas } : {}),
        ...(params.maxFeePerGas !== undefined
          ? { maxFeePerGas: params.maxFeePerGas }
          : {}),
        ...(params.maxPriorityFeePerGas !== undefined
          ? { maxPriorityFeePerGas: params.maxPriorityFeePerGas }
          : {}),
      } as unknown as Parameters<typeof coreWriteContract>[1];

      const macroAddress = getDashboardClearMacroAddress(params.chainId);
      if (params.clearMacro && macroAddress) {
        const publicClient = getPublicClient(config, { chainId: params.chainId });
        const code = await publicClient?.getCode({ address: account });
        const isEoa = code === undefined || code === "0x";
        if (isEoa) {
          let executionId: string | undefined;
          try {
            const relayed = await executeClearMacro(config, {
              chainId: params.chainId,
              signerAddress: account,
              action: params.clearMacro,
              macroAddress,
              relayRequired: params.clearMacroRequired,
              fallbackSimulationRequest:
                request as Parameters<typeof simulateContract>[1],
              onPhase: setRelayPhase,
              onExecutionCreated: (execution) => {
                executionId = execution.executionId;
                rememberClearMacroExecution({
                  ...execution,
                  chainId: params.chainId,
                  signerAddress: account,
                  createdAt: Date.now(),
                });
              },
            });
            forgetClearMacroExecution(relayed.executionId);
            return {
              hash: relayed.hash,
              chainId: params.chainId,
              relayed: true,
              executionId: relayed.executionId,
            };
          } catch (error) {
            if (error instanceof ClearMacroNotEligibleError) {
              if (params.clearMacroRequired) {
                throw new Error(
                  "The gasless transaction service is unavailable right now.",
                  { cause: error },
                );
              }
              setRelayPhase("fallback");
            } else if (
              error instanceof ClearMacroRelayError &&
              error.code === "POLL_TIMEOUT"
            ) {
              const unknownId = error.executionId ?? executionId;
              if (unknownId) setRelayStatusUnknown({ executionId: unknownId });
              setRelayPhase("relay-status-unknown");
              throw error;
            } else if (error instanceof ClearMacroInsufficientFeeError) {
              throw error;
            } else {
              throw error;
            }
          }
        } else if (params.clearMacroRequired) {
          throw new Error(
            "This transaction requires an EOA Clear Macro signature and cannot fall back.",
          );
        }
      } else if (params.clearMacroRequired) {
        throw new Error(
          "This transaction must be sent through Clear Macro, but no deployment is configured.",
        );
      }

      if (params.gas === undefined) {
        const publicClient = getPublicClient(config, { chainId: params.chainId });
        try {
          const estimated = await publicClient?.estimateContractGas({
            abi: params.abi,
            address: params.address,
            functionName: params.functionName,
            args: params.args,
            account,
            ...(params.value !== undefined ? { value: params.value } : {}),
          } as Parameters<
            NonNullable<typeof publicClient>["estimateContractGas"]
          >[0]);
          if (estimated) {
            (request as { gas?: bigint }).gas = (estimated * 120n) / 100n;
          }
        } catch {
          // Wallet estimation remains the fallback for transport and smart-account quirks.
        }
      }

      const hash = await coreWriteContract(config, request);
      return { hash, chainId: params.chainId, relayed: false };
    },
  });

  const { mutateAsync } = mutation;
  const write = useCallback(
    <
      const TAbi extends Abi,
      TFunctionName extends ContractFunctionName<TAbi, WriteMutability>,
      const TArgs extends ContractFunctionArgs<
        TAbi,
        WriteMutability,
        TFunctionName
      >,
    >(
      argsOrBuilder:
        | SuperfluidWriteArgs<TAbi, TFunctionName, TArgs>
        | (() =>
            | SuperfluidWriteArgs<TAbi, TFunctionName, TArgs>
            | Promise<SuperfluidWriteArgs<TAbi, TFunctionName, TArgs>>),
    ) =>
      mutateAsync(
        argsOrBuilder as unknown as
          | SuperfluidWriteArgs
          | SuperfluidWriteArgsBuilder,
      ),
    [mutateAsync],
  );

  const writeContractAsync = useCallback(
    (request: CompatibleWriteRequest) =>
      write(
        normalizeRequest(request, connectedAddress) as SuperfluidWriteArgs,
      ).then((outcome) => outcome.hash),
    [connectedAddress, write],
  );
  const writeContract = useCallback(
    (request: CompatibleWriteRequest) => {
      void writeContractAsync(request);
    },
    [writeContractAsync],
  );

  const result = {
    isUninitialized: mutation.isIdle,
    isLoading: mutation.isPending,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    relayPhase,
    relayStatusUnknown,
    reset: mutation.reset,
  };

  return {
    write,
    result,
    writeContract,
    writeContractAsync,
    data: mutation.data?.hash,
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    reset: mutation.reset,
    relayPhase,
    relayStatusUnknown,
  };
}
