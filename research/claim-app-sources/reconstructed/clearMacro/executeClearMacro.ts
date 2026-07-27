import {
  BaseError,
  ContractFunctionZeroDataError,
  formatEther,
  hashTypedData,
  type Address,
  type Hex,
} from "viem";
import {
  readContract,
  signTypedData,
  simulateContract,
  type Config,
} from "@wagmi/core";
import {
  clearMacroForwarderAbi,
  clearMacroForwarderAddress,
  superTokenAbi,
} from "@sfpro/sdk/abi";

import {
  CLEAR_MACRO_LANG,
  dashboardClearMacroAbi,
  getActionCallInfo,
  parseEIP712TypeDef,
  resolveActionFieldValue,
  type ClearMacroAction,
} from "./dashboardClearMacro";
import {
  createRelayExecution,
  getCapabilities,
  getFinalTransactionHash,
  pollRelayExecutionUntilTerminal,
} from "./relayApi";

export type ClearMacroPhase =
  | "preparing"
  | "awaiting-signature"
  | "relaying"
  | "fallback"
  | "relay-status-unknown";

export class ClearMacroNotEligibleError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ClearMacroNotEligibleError";
  }
}

export class ClearMacroInsufficientFeeError extends Error {
  constructor(
    message: string,
    public readonly details: {
      feeToken: Address;
      requiredFee: bigint;
      availableBalance: bigint;
    },
  ) {
    super(message);
    this.name = "ClearMacroInsufficientFeeError";
  }
}

interface ClearMacroSecurity {
  domain: string;
  macroContract: Address;
  provider: string;
  validAfter: bigint;
  validBefore: bigint;
  nonce: bigint;
}

export async function executeClearMacro(
  config: Config,
  params: {
    chainId: number;
    signerAddress: Address;
    action: ClearMacroAction;
    macroAddress: Address;
    fallbackSimulationRequest?: Parameters<typeof simulateContract>[1];
    relayRequired?: boolean;
    onPhase?: (phase: ClearMacroPhase) => void;
    onExecutionCreated?: (info: {
      executionId: string;
      validBefore: number;
    }) => void | Promise<void>;
  },
): Promise<{ hash: Hex; executionId: string }> {
  const { chainId, signerAddress, action, macroAddress } = params;
  params.onPhase?.("preparing");

  const forwarderAddress =
    clearMacroForwarderAddress[
      chainId as keyof typeof clearMacroForwarderAddress
    ];
  if (!forwarderAddress) {
    throw new ClearMacroNotEligibleError(
      "No ClearMacroForwarder deployment for chain " + chainId + ".",
    );
  }

  const capabilities = await getCapabilities().catch((error) => {
    throw new ClearMacroNotEligibleError(
      "Relay provider capabilities unavailable.",
      { cause: error },
    );
  });
  const capability = capabilities.chains.find(
    (candidate) => candidate.chainId === chainId,
  );
  if (!capability || !capability.supportedKinds.includes("clearMacroV1")) {
    throw new ClearMacroNotEligibleError(
      "Relay provider does not serve Clear Macro V1 on chain " + chainId + ".",
    );
  }
  if (capability.forwarderAddress.toLowerCase() !== forwarderAddress.toLowerCase()) {
    throw new ClearMacroNotEligibleError(
      "Relay forwarder does not match the configured chain deployment.",
    );
  }

  const callInfo = getActionCallInfo(action);
  let actionParams: Hex;
  let encodedPayload: Hex;
  let typedData: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: Address;
    };
    types: Record<string, { type: string; name: string }[]>;
    primaryType: string;
    message: Record<string, unknown>;
  };
  let security: ClearMacroSecurity;

  try {
    const nonce = (await readContract(config, {
      chainId,
      abi: clearMacroForwarderAbi,
      address: forwarderAddress,
      functionName: "getNonce",
      args: [signerAddress, 0n],
    } as unknown as Parameters<typeof readContract>[1])) as bigint;

    actionParams = (await readContract(config, {
      chainId,
      abi: dashboardClearMacroAbi,
      address: macroAddress,
      functionName: callInfo.encodeFunctionName,
      args: [CLEAR_MACRO_LANG, callInfo.tuple],
    } as unknown as Parameters<typeof readContract>[1])) as Hex;

    security = {
      domain: capabilities.providerName,
      macroContract: macroAddress,
      provider: capabilities.providerName,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1_000) + 600),
      nonce,
    };

    encodedPayload = (await readContract(config, {
      chainId,
      abi: clearMacroForwarderAbi,
      address: forwarderAddress,
      functionName: "encodeParams",
      args: [actionParams, security],
    } as unknown as Parameters<typeof readContract>[1])) as Hex;

    const [typeDefinition, primaryType, description, eip712Domain] =
      await Promise.all([
        readContract(config, {
          chainId,
          abi: clearMacroForwarderAbi,
          address: forwarderAddress,
          functionName: "getTypeDefinition",
          args: [macroAddress, encodedPayload],
        } as unknown as Parameters<typeof readContract>[1]) as Promise<string>,
        readContract(config, {
          chainId,
          abi: dashboardClearMacroAbi,
          address: macroAddress,
          functionName: "getPrimaryTypeName",
          args: [encodedPayload],
        } as unknown as Parameters<typeof readContract>[1]) as Promise<string>,
        readContract(config, {
          chainId,
          abi: dashboardClearMacroAbi,
          address: macroAddress,
          functionName: callInfo.describeFunctionName,
          args: [CLEAR_MACRO_LANG, callInfo.tuple],
        } as unknown as Parameters<typeof readContract>[1]) as Promise<string>,
        readContract(config, {
          chainId,
          abi: clearMacroForwarderAbi,
          address: forwarderAddress,
          functionName: "eip712Domain",
        } as unknown as Parameters<typeof readContract>[1]) as Promise<
          readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]]
        >,
      ]);

    const types = parseEIP712TypeDef(typeDefinition);
    const primaryFields = types[primaryType];
    const actionField = primaryFields?.find((field) => field.name === "action");
    const securityField = primaryFields?.find((field) => field.name === "security");
    const actionFields = actionField ? types[actionField.type] : undefined;
    const securityFields = securityField ? types[securityField.type] : undefined;
    if (!primaryFields || !actionFields || !securityFields) {
      throw new ClearMacroNotEligibleError(
        "Unexpected EIP-712 type definition from the Clear Macro forwarder.",
      );
    }

    const actionMessage: Record<string, unknown> = {};
    for (const field of actionFields) {
      const value = resolveActionFieldValue(action, description, field.name);
      if (value === undefined) {
        throw new ClearMacroNotEligibleError(
          "No value for EIP-712 Action field " + field.name + ".",
        );
      }
      actionMessage[field.name] = value;
    }
    const securityMessage: Record<string, unknown> = {};
    for (const field of securityFields) {
      const value = (security as unknown as Record<string, unknown>)[field.name];
      if (value === undefined) {
        throw new ClearMacroNotEligibleError(
          "No value for EIP-712 Security field " + field.name + ".",
        );
      }
      securityMessage[field.name] = value;
    }

    const [, domainName, domainVersion, domainChainId, verifyingContract] =
      eip712Domain;
    typedData = {
      domain: {
        name: domainName,
        version: domainVersion,
        chainId: Number(domainChainId),
        verifyingContract,
      },
      types,
      primaryType,
      message: { action: actionMessage, security: securityMessage },
    };

    const digestOnChain = (await readContract(config, {
      chainId,
      abi: clearMacroForwarderAbi,
      address: forwarderAddress,
      functionName: "getDigest",
      args: [macroAddress, encodedPayload],
    } as unknown as Parameters<typeof readContract>[1])) as Hex;
    const digestLocal = hashTypedData(
      typedData as Parameters<typeof hashTypedData>[0],
    );
    if (digestLocal.toLowerCase() !== digestOnChain.toLowerCase()) {
      throw new ClearMacroNotEligibleError(
        "The locally assembled Clear Macro digest does not match the forwarder.",
      );
    }
  } catch (error) {
    if (error instanceof ClearMacroNotEligibleError) throw error;
    throw new ClearMacroNotEligibleError(
      "Clear Macro payload assembly failed.",
      { cause: error },
    );
  }

  let feeQuote:
    | readonly [Address, Address, bigint, bigint]
    | undefined;
  try {
    feeQuote = (await readContract(config, {
      chainId,
      abi: dashboardClearMacroAbi,
      address: macroAddress,
      functionName: "previewRelayFee",
      args: [actionParams, signerAddress],
    } as unknown as Parameters<typeof readContract>[1])) as readonly [
      Address,
      Address,
      bigint,
      bigint,
    ];
  } catch (error) {
    const missing =
      error instanceof BaseError &&
      error.walk((item) => item instanceof ContractFunctionZeroDataError) != null;
    if (!missing) {
      throw new ClearMacroNotEligibleError("Relay fee preview failed.", {
        cause: error,
      });
    }
  }

  const feeToken = feeQuote?.[0];
  const requiredFee = feeQuote?.[2] ?? 0n;
  if (feeToken && requiredFee > 0n) {
    const [availableBalance] = (await readContract(config, {
      chainId,
      abi: superTokenAbi,
      address: feeToken,
      functionName: "realtimeBalanceOfNow",
      args: [signerAddress],
    } as unknown as Parameters<typeof readContract>[1])) as readonly [
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    let effectiveBalance = availableBalance;
    if (action.superToken.toLowerCase() === feeToken.toLowerCase()) {
      if (action.kind === "upgrade") effectiveBalance += action.amount;
      if (action.kind === "transfer" || action.kind === "downgrade") {
        effectiveBalance -= action.amount;
      }
    }
    if (effectiveBalance < requiredFee) {
      throw new ClearMacroInsufficientFeeError(
        "The gasless relay needs " + formatEther(requiredFee) +
          " fee-token units, but only " +
          formatEther(effectiveBalance < 0n ? 0n : effectiveBalance) +
          " are available.",
        { feeToken, requiredFee, availableBalance },
      );
    }
  }

  if (params.fallbackSimulationRequest) {
    await simulateContract(config, params.fallbackSimulationRequest);
  }

  params.onPhase?.("awaiting-signature");
  const signature = await signTypedData(config, {
    account: signerAddress,
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  } as Parameters<typeof signTypedData>[1]);

  params.onPhase?.("relaying");
  const execution = await createRelayExecution({
    kind: "clearMacroV1",
    chainId,
    macroAddress,
    signerAddress,
    payload: encodedPayload,
    signature,
    metadata: { source: "sup-reclaim" },
  });
  await params.onExecutionCreated?.({
    executionId: execution.id,
    validBefore: Number(execution.validity.validBefore),
  });
  const terminal = await pollRelayExecutionUntilTerminal(execution.id);
  return { hash: getFinalTransactionHash(terminal)!, executionId: terminal.id };
}
