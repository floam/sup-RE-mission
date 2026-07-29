import type { Address } from "viem";

import type { CmsPointEvent } from "../lib/cms-client";

export interface EventSelection {
  account: Address;
  programId: bigint;
}

export interface EventBreakdown {
  selection: EventSelection;
  events: CmsPointEvent[];
  message: string;
}
