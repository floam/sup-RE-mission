// Inferred reconstruction from claim.superfluid.org production bundles.
// Names and module boundary are inferred; wire-level fields and bigint behavior are preserved.

export interface ProgramOnchainInfo {
  poolAddress?: `0x${string}`;
  fundingFlowRate?: bigint;
  fundingStartDate?: number;
  fundingEndDate?: number;
  totalAllocated?: bigint;
  totalClaimed?: bigint;
  totalClaimedTimestamp?: number;
  totalMembers?: bigint;
  isFundingStarted: boolean;
  isFundingFinished: boolean;
}

export interface ClaimProgram {
  id: string;
  sharedAllocation?: boolean;
  onchainInfo: ProgramOnchainInfo;
}

export interface ProgramApp {
  appId: string;
  name: string;
  description: string;
  category: string;
  season?: string;
  logoUrl: string;
  url: string;
  isExpired?: boolean;
  totalAllocatedHint?: bigint;
  program?: ClaimProgram;
}

export interface ProgramBalance {
  balance: bigint;
  flowRate: bigint;
  timestamp: bigint;
}
