import type { Address } from "viem";

import type { CmsPointEvent } from "../lib/cms-client";

export type ReconciliationStatus =
  | "matched"
  | "partial"
  | "capped"
  | "no-change"
  | "missing";

export interface PendingClaimCampaignExplanation {
  campaignId: number;
  reconciliationStatus: ReconciliationStatus;
  onchainPoints: number;
  uncappedPoints: number;
  claimablePoints: number;
  targetPoints: number;
  explainedPoints: number;
  events: CmsPointEvent[];
  message?: string;
}

export interface PendingClaimEventsResponse
  extends PendingClaimCampaignExplanation {
  boundaryStatus?:
    | "confirmed-claim"
    | "indexed-claim-unverified"
    | "no-claim"
    | "no-locker";
  lastClaimAt?: string | null;
  lastIndexedClaimAt?: string | null;
}

export interface PendingClaimEventsBatchResponse {
  account: Address;
  lockerAddress: Address | null;
  results: PendingClaimCampaignExplanation[];
  message?: string;
}

export interface EventSelection {
  account: Address;
  programId: bigint;
}

export interface EventBreakdown {
  selection: EventSelection;
  events: CmsPointEvent[];
  message: string;
  reconciliationStatus?: ReconciliationStatus;
  targetPoints?: number;
  explainedPoints?: number;
}
