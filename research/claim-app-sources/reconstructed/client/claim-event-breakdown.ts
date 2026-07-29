import type { Address } from "viem";

import type { CmsPointEvent } from "../lib/cms-client";

export interface PendingClaimEventsResponse {
  boundaryStatus:
    | "confirmed-claim"
    | "indexed-claim-unverified"
    | "no-claim"
    | "no-locker";
  lastClaimAt: string | null;
  lastIndexedClaimAt: string | null;
  events: CmsPointEvent[];
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
  lastClaimAt?: string | null;
}
