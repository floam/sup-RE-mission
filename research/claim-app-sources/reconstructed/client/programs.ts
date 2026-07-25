export const SUP_SUBGRAPH =
  "https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn";

export interface PublicProgram {
  id: string;
  distributionPool: string;
  fundingAmount: string;
  subsidyAmount: string;
  endDate: string;
  stoppedDate: string | null;
}

export function getProgramStatus(
  program: Pick<PublicProgram, "stoppedDate" | "endDate">,
  now = Math.floor(Date.now() / 1_000),
) {
  if (BigInt(program.stoppedDate ?? "0") > 0n) return "Stopped" as const;
  if (BigInt(program.endDate || "0") > BigInt(now)) return "Active" as const;
  return "Finished" as const;
}

export async function getPublicPrograms(): Promise<PublicProgram[]> {
  const response = await fetch(SUP_SUBGRAPH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query { programs(first: 1000, orderBy: id, orderDirection: desc) { id distributionPool fundingAmount subsidyAmount endDate stoppedDate } }`,
    }),
  });
  if (!response.ok) throw new Error(`SUP subgraph returned ${response.status}`);
  const payload = (await response.json()) as {
    data?: { programs: PublicProgram[] };
    errors?: unknown;
  };
  if (!payload.data)
    throw new Error(
      `SUP subgraph query failed: ${JSON.stringify(payload.errors)}`,
    );
  return payload.data.programs;
}
