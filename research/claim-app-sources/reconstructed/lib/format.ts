import { formatEther, parseEther } from "viem";

export const SUP_SYMBOL = "SUP";
export const SECONDS_PER_MONTH = 2_628_000n;

export function formatTokenAmount(value: bigint, decimalPlaces = 2): string {
  return Number(formatEther(value)).toLocaleString("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

export function formatCompactTokenAmount(value: bigint): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Number(formatEther(value)));
}

export function formatMonthlyFlowRate(flowRate: bigint): string {
  return formatTokenAmount(SECONDS_PER_MONTH * flowRate);
}

export function parseTokenAmount(value: string): bigint {
  return parseEther(value || "0");
}

export function sanitizeTokenInput(value: string): string {
  const sanitized = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...fraction] = sanitized.split(".");
  return fraction.length ? `${whole}.${fraction.join("")}` : whole;
}

export function inferDecimalPlaces(value: bigint): number {
  const absolute = value < 0n ? -value : value;
  if (absolute === 0n) return 2;
  if (absolute >= 10n ** 18n) return 2;
  if (absolute >= 10n ** 16n) return 4;
  return 6;
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
