/** Inferred application types; field names and bigint semantics are bundle-backed. */

export type Address = `0x${string}`;

export interface ProgramOnchainInfo {
  poolAddress: Address;
  fundingFlowRate: bigint;
  subsidyFlowRate: bigint;
  fundingStartDate: bigint;
  fundingEndDate: bigint;
  programDuration: bigint;
  totalAllocated: bigint;
  totalClaimed: bigint;
  totalClaimedTimestamp: number;
  totalMembers: number;
  isFundingStarted: boolean;
  isFundingFinished: boolean;
}

export interface ClaimProgram {
  /** Integer program identifier validated by the client schema in module 69515. */
  id: number;
  sharedAllocation?: boolean;
  onchainInfo: ProgramOnchainInfo;
}

export interface ProgramApp {
  appId: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  season?: "1" | "2" | "3" | "4" | "5" | "6";
  logoUrl: string;
  coverUrl: string;
  url: string;
  cta: string;
  bgColor: string;
  isExpired?: boolean;
  totalAllocatedHint?: bigint;
  program?: ClaimProgram;
}

export interface ProgramBalance {
  balance: bigint;
  flowRate: bigint;
  /** Whole Unix seconds, derived from the contract query's `dataUpdatedAt`. */
  timestamp: bigint;
}

/** Result consumed from the `getProgramPoolInfos` server action (webpack 69515). */
export interface ProgramPoolInfo {
  programId: bigint;
  totalFlowRate: bigint;
  totalUnits: bigint;
}

export interface AddressProfile {
  addressChecksummed: Address;
  addressTruncated: string;
  profile: {
    recommendedName?: string;
    recommendedAvatar?: string;
    [field: string]: unknown;
  } | null;
  primaryName?: string | null;
  primaryAvatarUrl?: string | null;
}

export interface LeaderboardEntry {
  accountAddress: Address;
  flowRate: string;
  rank: number;
}
