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
  const cmsCampaignIds = [
    ...new Set(
      programs.map((program) => Number(program.id)).filter(Number.isSafeInteger),
    ),
  ];

  return {
    cmsCampaignIds,
    cmsBatches: chunkItems(cmsCampaignIds, CMS_BATCH_SIZE),
    comparablePrograms: programs.filter(
      (program) => getProgramStatus(program, now) === "Active",
    ),
  };
}

export async function fetchCmsBatches<T>(
  batches: readonly (readonly number[])[],
  fetchBatch: (campaignIds: number[]) => Promise<T>,
): Promise<T[]> {
  return Promise.all(batches.map((batch) => fetchBatch([...batch])));
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
