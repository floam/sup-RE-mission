import type { Address } from "./program-app";

export interface TransactionStatus {
  displayText: string;
  isLoading: boolean;
  isError: boolean;
  isFinished: boolean;
}

export type ClaimTransaction =
  | {
      type: "single";
      programId: bigint;
      totalProgramUnits: bigint;
      nonce: bigint;
      stackSignature: `0x${string}`;
    }
  | {
      type: "batch";
      programIds: readonly bigint[];
      totalProgramUnits: readonly bigint[];
      nonce: bigint;
      stackSignature: `0x${string}`;
    };

export interface ProgramPointState {
  programId: bigint;
  offchainPoints: bigint;
  onchainPoints: bigint;
  isOnchainOutdated: boolean;
}

export interface RecentTransaction {
  type: string;
  hash: `0x${string}`;
  account?: Address;
  timestamp: number;
}
