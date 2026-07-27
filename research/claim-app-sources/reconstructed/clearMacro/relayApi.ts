import type { Address, Hex } from "viem";

const RELAY_PROVIDER_BASE_URL = "/clearmacro-provider";
const REQUEST_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000;

export interface RelayCapabilities {
  providerName: string;
  chains: {
    chainId: number;
    forwarderAddress: Address;
    supportedKinds: string[];
    macroPolicy: { mode: string };
  }[];
}

export interface RelayExecution {
  id: string;
  state: "pending" | "submitted" | "succeeded" | "reverted" | "rejected" | "failed" | "expired" | "canceled";
  terminal: boolean;
  chainId: number;
  forwarderAddress: Address;
  macroAddress: Address;
  signerAddress: Address;
  validity: { validAfter: string; validBefore: string };
  transaction?: { hash: Hex };
  receipt?: { transactionHash: Hex; status: "success" | "reverted" };
  error?: { code: string; message: string; details?: unknown };
}

export class ClearMacroRelayError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly executionId?: string,
  ) {
    super(message);
    this.name = "ClearMacroRelayError";
  }
}

let capabilitiesCache: Promise<RelayCapabilities> | undefined;

export function getCapabilities(): Promise<RelayCapabilities> {
  if (!capabilitiesCache) {
    capabilitiesCache = fetch(RELAY_PROVIDER_BASE_URL + "/v1/capabilities").then(async (response) => {
      if (!response.ok) {
        throw new ClearMacroRelayError(
          "Relay provider capabilities request failed (HTTP " + response.status + ").",
        );
      }
      return (await response.json()) as RelayCapabilities;
    });
    capabilitiesCache.catch(() => {
      capabilitiesCache = undefined;
    });
  }
  return capabilitiesCache;
}

export async function createRelayExecution(body: {
  kind: "clearMacroV1";
  chainId: number;
  macroAddress: Address;
  signerAddress: Address;
  payload: Hex;
  signature: Hex;
  metadata?: Record<string, string>;
}): Promise<RelayExecution> {
  const response = await fetch(RELAY_PROVIDER_BASE_URL + "/v1/relay-executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = "Relay execution request failed (HTTP " + response.status + ").";
    let code: string | undefined;
    let executionId: string | undefined;
    try {
      const parsed = (await response.json()) as {
        error?: { message?: string; code?: string; executionId?: string; details?: unknown };
      };
      if (parsed.error?.message) {
        message = "Relay rejected the execution: " + parsed.error.message;
        if (parsed.error.details) message += " Details: " + JSON.stringify(parsed.error.details);
      }
      code = parsed.error?.code;
      executionId = parsed.error?.executionId;
    } catch {
      // Preserve the HTTP fallback message.
    }
    throw new ClearMacroRelayError(message, code, executionId);
  }
  return (await response.json()) as RelayExecution;
}

async function getRelayExecution(id: string): Promise<RelayExecution> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      RELAY_PROVIDER_BASE_URL + "/v1/relay-executions/" + encodeURIComponent(id),
      { signal: controller.signal },
    );
    if (!response.ok) {
      throw new ClearMacroRelayError(
        "Relay execution lookup failed (HTTP " + response.status + ").",
        undefined,
        id,
      );
    }
    return (await response.json()) as RelayExecution;
  } finally {
    clearTimeout(timer);
  }
}

export function getFinalTransactionHash(execution: RelayExecution): Hex | undefined {
  return execution.receipt?.transactionHash ?? execution.transaction?.hash;
}

export async function pollRelayExecutionUntilTerminal(id: string): Promise<RelayExecution> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    try {
      const execution = await getRelayExecution(id);
      if (execution.terminal) {
        if (execution.state === "succeeded" && getFinalTransactionHash(execution)) return execution;
        throw new ClearMacroRelayError(
          "Relayed transaction " + execution.state +
            (execution.error?.message ? ": " + execution.error.message : "") +
            " (execution " + id + ").",
          execution.error?.code,
          id,
        );
      }
    } catch (error) {
      if (error instanceof ClearMacroRelayError && error.code !== undefined) throw error;
      if (Date.now() >= deadline) {
        throw new ClearMacroRelayError(
          "Timed out waiting for the relayed transaction (execution " + id + ").",
          "POLL_TIMEOUT",
          id,
        );
      }
    }
    if (Date.now() >= deadline) {
      throw new ClearMacroRelayError(
        "Timed out waiting for the relayed transaction (execution " + id + ").",
        "POLL_TIMEOUT",
        id,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
