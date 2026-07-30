"use client";

import { useQuery } from "@tanstack/react-query";

import { EXTERNAL_ENDPOINTS } from "../../lib/endpoints";

export function TotalMembers() {
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
  return isSuccess ? data : <span className="invisible">N/A</span>;
}
