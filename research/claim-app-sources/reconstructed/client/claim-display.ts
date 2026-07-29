import { formatUnits as formatTokenUnits } from "viem";

import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";

const SECONDS_PER_MONTH = 2_628_000n;
const flowFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});
const listFormat = new Intl.ListFormat("en-US", {
  style: "long",
  type: "conjunction",
});
const boundaryFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatMonthlyFlow(flowRate: bigint, signed = false) {
  const value = Number(
    formatTokenUnits(flowRate * SECONDS_PER_MONTH, 18),
  );
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

export function formatBoundary(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? boundaryFormat.format(date)
    : "your previous update";
}

export function getCampaignAttribution(programId: bigint) {
  const definitions = PROGRAM_APP_DEFINITIONS.filter(
    (app) => app.program?.id === Number(programId),
  );
  return {
    names: [...new Set(definitions.map((app) => app.name))],
    descriptors: [
      ...new Set(
        definitions.map(
          (app) => `Season ${app.season ?? "—"} · ${app.category}`,
        ),
      ),
    ],
  };
}
