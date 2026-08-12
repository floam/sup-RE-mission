import type { Chain } from "viem";

import type { Address } from "./program-app";
import type { TransactionStatus } from "./transactions";

export interface ActivityTier {
  minPrograms: number;
  tier: number;
  name: string;
  normalRollMax: number;
  rareRollMin: number;
  rareRollMax: number;
}

export interface MysteryBoxCheck {
  success: boolean;
  error?: string;
  shouldShow?: boolean;
  activePrograms: number;
  hasSupStakingBonus?: boolean;
  /** Unix timestamp read from the mystery-box contract. */
  lastClaimTime?: number;
}

export interface MysteryBoxResult {
  success: boolean;
  error?: string;
  points?: number;
  supPerMonth?: number;
  isRareRoll?: boolean;
  nextTierReward?: number;
}

export interface PendingMysteryBoxClaim {
  txHash: `0x${string}`;
  address: Address;
  status: "pending" | "succeeded" | "claiming";
}

export interface DailyMysteryBoxState {
  showModal: boolean;
  canClaim: boolean;
  mysteryBoxData: MysteryBoxCheck | null;
  openResult: MysteryBoxResult | null;
  isLoading: boolean;
  status?: TransactionStatus | null;
  chain: Chain;
  hasSupStakingBonus: boolean;
}

export interface BonusCheck {
  success: boolean;
  error?: string;
  shouldShow?: boolean;
  supPerMonth: number;
}

export interface BonusClaimResult {
  success: boolean;
  error?: string;
  points?: number;
  supPerMonth?: number;
  isBigBonus?: boolean;
}
