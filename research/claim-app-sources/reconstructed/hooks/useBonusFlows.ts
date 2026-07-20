import { API_ENDPOINTS } from "../lib/endpoints";
import type { BonusCheck, BonusClaimResult } from "../types/campaign-rewards";
import type { Address } from "../types/program-app";

export async function checkBonusFlows(address: Address): Promise<BonusCheck> {
  try {
    const response = await fetch(API_ENDPOINTS.bonusFlowsCheck(address));
    const body = (await response.json()) as Omit<BonusCheck, "success"> & {
      error?: string;
    };
    return { ...body, success: body.error === undefined };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      supPerMonth: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function claimBonusFlows(
  address: Address,
): Promise<BonusClaimResult> {
  try {
    const response = await fetch(API_ENDPOINTS.bonusFlowsClaim, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = (await response.json()) as BonusClaimResult;
    return body.error
      ? { success: false, error: body.error }
      : {
          success: true,
          points: body.points,
          supPerMonth: body.supPerMonth,
          isBigBonus: body.isBigBonus,
        };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
