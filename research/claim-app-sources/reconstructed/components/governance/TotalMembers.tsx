"use client";

import { useQuery } from "@tanstack/react-query";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
import { EXTERNAL_ENDPOINTS } from "../../lib/endpoints";

export function TotalMembers() {
  const { airdropChain } = useExpectedChains();
  const apiBase = EXTERNAL_ENDPOINTS.supMetrics;
  const { data, isSuccess } = useQuery({
    queryKey: ["holderCount"],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/v1/dao_members_count`, {
        next: { revalidate: 900 },
      });
      const body = await response.json();
      if (body.daoMembersCount === undefined)
        throw new Error("Response doesn't contain daoMembersCount", {
          cause: body,
        });
      return body.daoMembersCount as number;
    },
  });
  void airdropChain; // Both supported chain IDs map to the same observed metrics API.
  return isSuccess ? data : <span className="invisible">N/A</span>;
}
