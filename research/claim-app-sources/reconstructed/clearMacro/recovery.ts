import type { Address } from "viem";

const STORAGE_KEY = "sup-reclaim-clear-macro-executions-v1";

export interface PendingClearMacroExecution {
  executionId: string;
  chainId: number;
  signerAddress: Address;
  validBefore: number;
  createdAt: number;
}

function readAll(): PendingClearMacroExecution[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as PendingClearMacroExecution[]) : [];
  } catch {
    return [];
  }
}

function writeAll(executions: PendingClearMacroExecution[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(executions));
  } catch {
    // Recovery persistence is best effort in embedded wallets.
  }
}

export function rememberClearMacroExecution(execution: PendingClearMacroExecution) {
  writeAll([
    ...readAll().filter((entry) => entry.executionId !== execution.executionId),
    execution,
  ]);
}

export function forgetClearMacroExecution(executionId: string) {
  writeAll(readAll().filter((entry) => entry.executionId !== executionId));
}

export function listPendingClearMacroExecutions() {
  return readAll();
}
