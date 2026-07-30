import { parseAbi } from "viem";
import { supTokenAddress } from "@sfpro/sdk/abi/sup";

import { BASE_CHAIN_ID } from "../config/chains";

/**
 * Protocol-wide ABIs are imported by consumers from `@sfpro/sdk/abi/sup`.
 * The app bundle's generated address table (webpack 67574) supplied these Base
 * production identities; the mainnet values are independently cataloged by the
 * official Superfluid SDK/skill.
 */
export const FLUID_LOCKER_FACTORY_ADDRESS = {
  [BASE_CHAIN_ID]: "0xA6694cAB43713287F7735dADc940b555db9d39D9",
} as const;

export const PROGRAM_MANAGER_ADDRESS = {
  [BASE_CHAIN_ID]: "0x1e32cf099992E9D3b17eDdDFFfeb2D07AED95C6a",
} as const;

export const DELEGATE_MANAGER_ADDRESS = {
  [BASE_CHAIN_ID]: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
} as const;

export const MYSTERY_BOX_ADDRESS = {
  [BASE_CHAIN_ID]: "0x7D3228cbF6dB5Cb6E50C6d15B386c3bc8066e1bC",
} as const;

export const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = {
  [BASE_CHAIN_ID]: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
} as const;

export const ETH_SUP_POOL_ADDRESS = {
  [BASE_CHAIN_ID]: "0xba154beaa14172ff9384b82499732c669527d85d",
} as const;

/** Distribution-pool identities returned by the recovered metrics actions. */
export const TAX_DISTRIBUTION_POOL_ADDRESS = {
  [BASE_CHAIN_ID]: "0xf0f494f4bd2c3a6bf8b49e6f798875301d944c0a",
} as const;

export const LP_DISTRIBUTION_POOL_ADDRESS = {
  [BASE_CHAIN_ID]: "0x7e173C3981bF8a786FE6750e8964DD7b25443977",
} as const;

export const RESERVE_NAME_REGISTRAR_ADDRESS = {
  [BASE_CHAIN_ID]: "0x5e84F4F6d8e04D1B9Fdf5d83d7d471D45b57245f",
} as const;

export const WETH_ADDRESS = {
  [BASE_CHAIN_ID]: "0x4200000000000000000000000000000000000006",
} as const;

/** Generated deployment table used by webpack export `Gc`. */
export const SUP_TOKEN_ADDRESS_BY_CHAIN = supTokenAddress;

/** Narrow GDA pool read fragment retained because @sfpro/sdk does not export it. */
export const gdaPoolReadAbi = parseAbi([
  "function getTotalAmountReceivedByMember(address member) view returns (uint256)",
  "function getMemberFlowRate(address member) view returns (int96)",
  "function getTotalFlowRate() view returns (int96)",
  "function getTotalUnits() view returns (uint128)",
]);

export const NATIVE_TOKEN_ADDRESS =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const UNLOCKING_FEE = 100_000_000_000_000n; // parseEther("0.0001")
export const MIN_UNLOCK_AMOUNT = 10_000_000_000_000_000_000n; // parseEther("10")
export const MIN_UNLOCK_DAYS = 7;
export const MAX_UNLOCK_DAYS = 365;

/** Small app-owned ABI embedded in webpack 88178. */
export const delegateManagerAbi = parseAbi([
  "event ClearDelegate(address indexed delegator, bytes32 indexed id, address indexed delegate)",
  "event SetDelegate(address indexed delegator, bytes32 indexed id, address indexed delegate)",
  "function clearDelegate(bytes32 id)",
  "function delegation(address, bytes32) view returns (address)",
  "function setDelegate(bytes32 id, address delegate)",
]);

/** Small app-owned ABI embedded in webpack 88178. */
export const mysteryBoxAbi = parseAbi([
  "event BoxOpened(address indexed user, uint256 timestamp)",
  "function CLAIM_COST() view returns (uint256)",
  "function COOLDOWN_PERIOD() view returns (uint256)",
  "function canClaim(address user) view returns (bool)",
  "function getTimeUntilNextClaim(address user) view returns (uint256)",
  "function lastClaimTime(address) view returns (uint256)",
  "function open() payable",
]);

/** Narrow fragment of the app-owned Reserve name registrar ABI (webpack 45537). */
export const reserveNameRegistrarAbi = parseAbi([
  "function domainName() view returns (string)",
  "function getUserSubdomain(address user) view returns (bytes32)",
  "function name(bytes32 node) view returns (string)",
  "function isSubdomainAvailable(bytes32 subdomainNode) view returns (bool available, address currentLocker)",
  "function registerSubdomain(address user, string subdomain) payable",
  "event SubdomainRegistered(address indexed user, address indexed locker, bytes32 indexed node, string subdomain)",
]);

/** Narrow Uniswap V3 fragments consumed by the claim application's liquidity UI. */
export const uniswapV3PoolAbi = parseAbi([
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
]);

/** Narrow fragment of the canonical Uniswap NonfungiblePositionManager. */
export const nonfungiblePositionManagerAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
  "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max) params) payable returns (uint256 amount0, uint256 amount1)",
]);

export const MAX_UINT128 = 0xffffffffffffffffffffffffffffffffn;
