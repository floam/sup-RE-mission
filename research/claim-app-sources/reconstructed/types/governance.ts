import type { Address } from "./program-app";

/** Fields returned by `/api/delegates`; optional fields occur in fallback rows. */
export interface DelegateProfile {
  address: Address;
  name: string;
  description: string;
  telegram: string;
  url: string;
  avatarOverride?: string;
  delegatedAmount?: number;
}

export interface SnapshotSpace {
  id: `0x${string}`;
  link: string;
}
