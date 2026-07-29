import { BASE_CHAIN_ID } from "./chains";
import type { SnapshotSpace } from "../types/governance";

/** Exact Snapshot space identifiers embedded in webpack module 55711. */
export const SNAPSHOT_SPACE_BY_CHAIN: Record<number, SnapshotSpace> = {
  [BASE_CHAIN_ID]: {
    link: "https://snapshot.box/#/s:superfluid.eth",
    id: "0x7375706572666c7569642e657468000000000000000000000000000000000000",
  },
};
