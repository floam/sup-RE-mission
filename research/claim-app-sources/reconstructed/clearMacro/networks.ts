import type { Address } from "viem";

/** DashboardClearMacro deployments verified by the Dashboard project. */
export const DASHBOARD_CLEAR_MACRO_ADDRESS: Readonly<Record<number, Address>> = {
  1: "0x1bBc06F00b9F5964eb8F7ED044e15C8dE13368bE",
  10: "0x4D11B0b59948d81EEAaF667CCDaA212f824949d4",
  56: "0x53d00397f03147A9bD9c40443A105A82780deAF1",
  100: "0x7786Da9DEC051b1CE13AA5d6701f6D2655D01De6",
  137: "0x478A32945F569FB3c14B72080c9e6f9AcEAAAc7D",
  8453: "0xC04FE9940e460457B75C3Aa4871bF142E0f49744",
  42161: "0x3BDd82FFbCcB9DBD0c233Ecd950642edbF60D667",
  43114: "0x02CF8483b15eb1211235D8bb5041BE5024Ef657F",
  11155420: "0x96ec6a06fb72c8C3e42E9DD3ae3525e7847078c3",
};

export function getDashboardClearMacroAddress(chainId: number): Address | undefined {
  if (process.env.NEXT_PUBLIC_DISABLE_CLEAR_MACRO === "true") return undefined;
  return DASHBOARD_CLEAR_MACRO_ADDRESS[chainId];
}
