"use client";

import { useQuery } from "@tanstack/react-query";

import { formatTokenAmount } from "../../lib/format";
import { getTotalDelegatedAmount } from "../../server-actions/stats";

export function TotalDelegated() {
  const { data, isSuccess } = useQuery({
    queryKey: ["delegatedAmount"],
    queryFn: getTotalDelegatedAmount,
  });
  return isSuccess ? (
    formatTokenAmount(BigInt(1e18 * data))
  ) : (
    <span className="invisible">N/A</span>
  );
}
