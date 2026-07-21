export const API_ENDPOINTS = {
  programs: "/api/programs",
  pointStates: (accountAddress: string) =>
    `/api/points/states?accountAddress=${accountAddress}`,
  pointClaim: (accountAddress: string) =>
    `/api/points/claim?accountAddress=${accountAddress}`,
  mysteryBoxCheck: (address: string) =>
    `/api/mystery-box/check?address=${address}`,
  mysteryBoxClaim: "/api/mystery-box/claim",
  bonusFlowsCheck: (address: string) =>
    `/api/bonus-flows/check?address=${address}`,
  bonusFlowsClaim: "/api/bonus-flows/claim",
  delegates: "/api/delegates",
  delegatedAmount: (address: string) =>
    `/api/delegates/amount?address=${address}`,
  leaderboard: (page: number, limit: number) =>
    `/api/leaderboard?page=${page}&limit=${limit}`,
  leaderboardSearch: (address: string) =>
    `/api/leaderboard/search?address=${address}`,
} as const;

export const EXTERNAL_ENDPOINTS = {
  whois: (address: string) =>
    `https://whois.superfluid.finance/api/resolve/${address}`,
  liFiBase: "https://li.quest/v1",
  supMetrics: "https://sup-metrics-api.superfluid.dev",
  referrals:
    "https://superfluid-eligibility-api.s.superfluid.dev/api/referrals",
  supSubgraph:
    "https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup/v2/gn",
  supTestSubgraph:
    "https://api.goldsky.com/api/public/project_clsnd6xsoma5j012qepvucfpp/subgraphs/sup_test/latest/gn",
  baseProtocolSubgraph:
    "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
  baseSepoliaProtocolSubgraph:
    "https://subgraph-endpoints.superfluid.dev/base-sepolia/protocol-v1",
  uniswapV3BaseSubgraph:
    process.env.UNISWAP_V3_BASE_SUBGRAPH_URL ??
    "https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest",
} as const;
