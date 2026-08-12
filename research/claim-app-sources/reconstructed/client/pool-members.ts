export const BASE_PROTOCOL_SUBGRAPH =
  "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1";

const PAGE_SIZE = 1000;

interface PoolMemberRow {
  id: string;
  units: string;
  pool: { id: string };
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function countActivePoolMembers(
  poolAddresses: readonly string[],
  rows: readonly PoolMemberRow[],
): Map<string, number> {
  const counts = new Map(
    poolAddresses.map((address) => [normalizeAddress(address), 0]),
  );

  for (const row of rows) {
    if (BigInt(row.units) <= 0n) continue;
    const pool = normalizeAddress(row.pool.id);
    if (!counts.has(pool)) continue;
    counts.set(pool, (counts.get(pool) ?? 0) + 1);
  }

  return counts;
}

export async function getActivePoolMemberCounts(
  poolAddresses: readonly string[],
): Promise<Map<string, number>> {
  const pools = [...new Set(poolAddresses.map(normalizeAddress))];
  if (pools.length === 0) return new Map();

  const rows: PoolMemberRow[] = [];
  let lastId = "";

  while (true) {
    const response = await fetch(BASE_PROTOCOL_SUBGRAPH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query ActivePoolMembers($pools: [String!]!, $lastId: String!) {
          poolMembers(
            first: ${PAGE_SIZE}
            orderBy: id
            orderDirection: asc
            where: { pool_in: $pools, units_gt: "0", id_gt: $lastId }
          ) {
            id
            units
            pool { id }
          }
        }`,
        variables: { pools, lastId },
      }),
    });

    if (!response.ok) {
      throw new Error(`Protocol subgraph returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: { poolMembers: PoolMemberRow[] };
      errors?: unknown;
    };
    if (!payload.data) {
      throw new Error(
        `Protocol pool-member query failed: ${JSON.stringify(payload.errors)}`,
      );
    }

    const page = payload.data.poolMembers;
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return countActivePoolMembers(pools, rows);
}
