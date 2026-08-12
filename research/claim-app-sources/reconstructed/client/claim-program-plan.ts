import { getProgramStatus, type PublicProgram } from "./programs.ts";

export const CMS_BATCH_SIZE = 50;

export interface ClaimProgramPlan {
  cmsCampaignIds: number[];
  cmsBatches: number[][];
  comparablePrograms: PublicProgram[];
}

export interface ClaimResultInput {
  lockerReady: boolean;
  comparableProgramCount: number;
  changedProgramCount: number;
}

export type ClaimResultKind =
  | "locker-required"
  | "no-active-programs"
  | "updates-found"
  | "synchronized";

export interface ClaimSubmissionErrorInput {
  confirmedBatches: number;
  detail: string;
  confirmationIncomplete: boolean;
}

export interface ClaimSubmissionErrorOutcome {
  kind: "error" | "warning";
  message: string;
  requiresRefresh: boolean;
}

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Chunk size must be a positive safe integer.");
  }

  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function buildClaimProgramPlan(
  programs: readonly PublicProgram[],
  now = Math.floor(Date.now() / 1_000),
): ClaimProgramPlan {
  const comparablePrograms = programs.filter(
    (program) => getProgramStatus(program, now) === "Active",
  );
  const cmsCampaignIds = [
    ...new Set(
      comparablePrograms
        .map((program) => Number(program.id))
        .filter(Number.isSafeInteger),
    ),
  ];

  return {
    cmsCampaignIds,
    cmsBatches: chunkItems(cmsCampaignIds, CMS_BATCH_SIZE),
    comparablePrograms,
  };
}

export function getClaimResultKind({
  lockerReady,
  comparableProgramCount,
  changedProgramCount,
}: ClaimResultInput): ClaimResultKind {
  if (!lockerReady) return "locker-required";
  if (comparableProgramCount === 0) return "no-active-programs";
  if (changedProgramCount > 0) return "updates-found";
  return "synchronized";
}

export function getClaimSubmissionErrorOutcome({
  confirmedBatches,
  detail,
  confirmationIncomplete,
}: ClaimSubmissionErrorInput): ClaimSubmissionErrorOutcome {
  if (confirmationIncomplete) {
    return {
      kind: "warning",
      message:
        confirmedBatches > 0
          ? `Confirmation incomplete: ${confirmedBatches} transaction${confirmedBatches === 1 ? "" : "s"} confirmed, and the next submitted transaction could not be verified. Refresh the stream state before retrying. ${detail}`
          : `Confirmation incomplete: the transaction was submitted, but its onchain result could not be verified. Refresh the stream state before retrying. ${detail}`,
      requiresRefresh: true,
    };
  }

  return {
    kind: "error",
    message:
      confirmedBatches > 0
        ? `Claim partially succeeded: ${confirmedBatches} transaction${confirmedBatches === 1 ? "" : "s"} confirmed before the next update failed: ${detail}`
        : `Claim failed: ${detail}`,
    requiresRefresh: confirmedBatches > 0,
  };
}
