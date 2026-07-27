import { parseAbi, type Address } from "viem";

import type { SuperfluidWriteArgs } from "./useSuperfluidWriteContract";

const abi = parseAbi([
  "function pay(uint256 amount) payable",
  "function ping(address account)",
]);

const payableWrite: SuperfluidWriteArgs<
  typeof abi,
  "pay",
  readonly [bigint]
> = {
  chainId: 8453,
  abi,
  address: "0x0000000000000000000000000000000000000001",
  functionName: "pay",
  args: [1n],
  value: 1n,
};
void payableWrite;

const nonpayableWrite: SuperfluidWriteArgs<
  typeof abi,
  "ping",
  readonly [Address]
> = {
  chainId: 8453,
  abi,
  address: "0x0000000000000000000000000000000000000001",
  functionName: "ping",
  args: ["0x0000000000000000000000000000000000000002"],
};
void nonpayableWrite;

const invalidValue: SuperfluidWriteArgs<
  typeof abi,
  "ping",
  readonly [Address]
> = {
  chainId: 8453,
  abi,
  address: "0x0000000000000000000000000000000000000001",
  functionName: "ping",
  args: ["0x0000000000000000000000000000000000000002"],
  // @ts-expect-error nonpayable writes cannot carry native value
  value: 1n,
};
void invalidValue;
