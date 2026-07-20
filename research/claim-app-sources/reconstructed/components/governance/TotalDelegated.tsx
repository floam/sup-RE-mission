"use client";

import { useQuery } from "@tanstack/react-query";

import { formatTokenAmount } from "../../lib/format";

/** Client evidence identifies server action `getTotalDelegatedAmount` as
 * `00cfeebe90442ab515b51fba3ba323324474e768b8`; its server body was not shipped. */
export function TotalDelegated({
  getTotalDelegatedAmount,
}: {
  getTotalDelegatedAmount(): Promise<number>;
}) {
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
