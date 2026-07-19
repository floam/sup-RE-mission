/**
 * Synthesized from claim.superfluid.org chunk 9443-ee8d2452e07f5651.js.
 *
 * This is an audit-oriented reconstruction, not a drop-in application module.
 * In particular, imports, ABI wrappers, analytics, and app-specific types have
 * been replaced with explicit interfaces or descriptive dependencies.
 */

export type ClaimTransaction =
  | {
      type: "single";
      programId: bigint;
      totalProgramUnits: bigint;
      nonce: bigint;
      stackSignature: `0x${string}`;
    }
  | {
      type: "batch";
      programIds: readonly bigint[];
      totalProgramUnits: readonly bigint[];
      nonce: bigint;
      stackSignature: `0x${string}`;
    };

export interface PointStateResponse {
  canClaim: boolean;
  programPointStates: Array<{
    programId: bigint;
    offchainPoints: bigint;
    onchainPoints: bigint;
    isOnchainOutdated: boolean;
  }>;
}

export interface ClaimResponse {
  canClaim: boolean;
  claimTransaction?: ClaimTransaction;
}

export interface ClaimCall {
  canClaim: boolean;
  functionName?:
    | "claim"
    | "claimAndStake"
    | "disconnectAndClaim"
    | "disconnectAndClaimAndStake";
  txArgs?: readonly unknown[];
}

/** Parses the SuperJSON text returned by the claim API. */
export async function readAccountProgramPointStates(
  accountAddress: `0x${string}`,
  parseSuperJson: (text: string) => PointStateResponse,
): Promise<PointStateResponse> {
  const response = await fetch(
    `/api/points/states?accountAddress=${accountAddress}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch account program point states");
  }
  return parseSuperJson(await response.text());
}

/** Reads the CMS-backed claim voucher prepared by the claim API. */
export async function readAccountPointClaim(
  accountAddress: `0x${string}`,
  parseSuperJson: (text: string) => ClaimResponse,
): Promise<ClaimResponse> {
  const response = await fetch(
    `/api/points/claim?accountAddress=${accountAddress}`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch account point claim");
  }
  return parseSuperJson(await response.text());
}

/**
 * Selects the FluidLocker claim method and exact argument order used by the client.
 * Finished-program pool IDs are disconnected before submitting a voucher update.
 */
export function buildClaimCall(
  claim: ClaimResponse | undefined,
  finishedProgramIds: readonly bigint[] | undefined,
  withStake: boolean,
): ClaimCall {
  const transaction = claim?.claimTransaction;
  if (!claim?.canClaim || !transaction) {
    return { canClaim: false };
  }

  const hasFinishedPools = Boolean(finishedProgramIds?.length);
  const functionName = hasFinishedPools
    ? withStake
      ? "disconnectAndClaimAndStake"
      : "disconnectAndClaim"
    : withStake
      ? "claimAndStake"
      : "claim";

  if (transaction.type === "single") {
    const voucherArgs = [
      transaction.programId,
      transaction.totalProgramUnits,
      transaction.nonce,
      transaction.stackSignature,
    ] as const;
    return {
      canClaim: true,
      functionName,
      txArgs: hasFinishedPools
        ? [finishedProgramIds!, [transaction.programId], ...voucherArgs.slice(1)]
        : voucherArgs,
    };
  }

  const voucherArgs = [
    transaction.programIds,
    transaction.totalProgramUnits,
    transaction.nonce,
    transaction.stackSignature,
  ] as const;
  return {
    canClaim: true,
    functionName,
    txArgs: hasFinishedPools
      ? [finishedProgramIds!, ...voucherArgs]
      : voucherArgs,
  };
}

/**
 * The bundle enables the voucher query only after these conditions hold. The caller
 * additionally suppresses it while a successful claim receipt is being processed.
 */
export function shouldReadClaimVoucher(input: {
  enabled: boolean;
  accountAddress?: string;
  canClaim: boolean;
  isFinished: boolean;
  isLoadingProgramPools: boolean;
  isLoadingProgramApps: boolean;
}): boolean {
  return (
    input.enabled &&
    Boolean(input.accountAddress) &&
    input.canClaim &&
    !input.isFinished &&
    !input.isLoadingProgramPools &&
    !input.isLoadingProgramApps
  );
}
