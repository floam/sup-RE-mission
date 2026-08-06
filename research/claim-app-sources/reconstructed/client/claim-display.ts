import { formatUnits as formatTokenUnits } from "viem";

import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";
import {
  buildProgramAttributions,
  type ProgramAttributions,
} from "./program-attribution";

const SECONDS_PER_MONTH = 2_628_000n;
const flowFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});
const listFormat = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});

export const STATIC_PROGRAM_ATTRIBUTIONS = buildProgramAttributions(
  PROGRAM_APP_DEFINITIONS,
);

export function formatMonthlyFlow(flowRate: bigint, signed = false) {
  const value = Number(formatTokenUnits(flowRate * SECONDS_PER_MONTH, 18));
  if (value !== 0 && Math.abs(value) < 0.0001) {
    return `${value < 0 ? "−" : signed ? "+" : ""}<0.0001 SUP/month`;
  }
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${flowFormat.format(value)} SUP/month`;
}

export function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatList(values: string[]) {
  return listFormat.format(values);
}

export function getCampaignAttribution(
  programId: bigint,
  attributions: ProgramAttributions = STATIC_PROGRAM_ATTRIBUTIONS,
) {
  return (
    attributions.get(Number(programId)) ?? {
      names: [],
      descriptors: [],
    }
  );
}
