import assert from "node:assert/strict";
import test from "node:test";

import {
  getProgramStatus,
  getPublicPrograms,
  type PublicProgram,
} from "../client/programs.ts";

function toIso(value: string | null | undefined): string | null {
  const seconds = BigInt(value ?? "0");
  if (seconds <= 0n) return null;
  return new Date(Number(seconds) * 1_000).toISOString();
}

function lifecycleSnapshot(program: PublicProgram) {
  return {
    id: program.id,
    status: getProgramStatus(program),
    endDate: program.endDate,
    endDateIso: toIso(program.endDate),
    earlyEndDate: program.earlyEndDate,
    earlyEndDateIso: toIso(program.earlyEndDate),
    stoppedDate: program.stoppedDate,
    stoppedDateIso: toIso(program.stoppedDate),
    cancellationDate: program.cancellationDate,
    cancellationDateIso: toIso(program.cancellationDate),
  };
}

test(
  "live SUP subgraph exposes at least one current program",
  { timeout: 60_000 },
  async () => {
    const programs = await getPublicPrograms();
    const active = programs.filter((program) => getProgramStatus(program) === "Active");
    const zeroEndUnterminated = programs.filter(
      (program) =>
        BigInt(program.endDate || "0") === 0n &&
        BigInt(program.earlyEndDate ?? "0") === 0n &&
        BigInt(program.stoppedDate ?? "0") === 0n &&
        BigInt(program.cancellationDate ?? "0") === 0n,
    );
    const furthestEnding = [...programs]
      .sort((left, right) => Number(BigInt(right.endDate || "0") - BigInt(left.endDate || "0")))
      .slice(0, 12)
      .map(lifecycleSnapshot);

    console.log(
      JSON.stringify(
        {
          now: new Date().toISOString(),
          totalPrograms: programs.length,
          activePrograms: active.map(lifecycleSnapshot),
          zeroEndUnterminated: zeroEndUnterminated.map(lifecycleSnapshot),
          furthestEnding,
        },
        null,
        2,
      ),
    );

    assert(
      active.length > 0,
      `SUP subgraph produced zero active programs; ${zeroEndUnterminated.length} unterminated programs have endDate=0`,
    );
  },
);
