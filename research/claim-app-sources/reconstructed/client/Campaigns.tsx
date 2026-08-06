"use client";

import { useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";

import { useProgramTotalFlowRate } from "../hooks/useProgramTotalFlowRate";
import { formatCompactTokenAmount, formatMonthlyFlowRate } from "../lib/format";
import styles from "./Campaigns.module.css";
import {
  getCampaignAttribution,
  STATIC_PROGRAM_ATTRIBUTIONS,
} from "./claim-display";
import {
  getPublicProgramAttributions,
  mergeProgramAttributions,
  type ProgramAttributions,
} from "./program-attribution";
import {
  getProgramStatus,
  getPublicPrograms,
  type PublicProgram,
} from "./programs";

type ProgramStatus = ReturnType<typeof getProgramStatus>;
type ProgramFilter = ProgramStatus | "All";

const FILTERS: ProgramFilter[] = ["All", "Active", "Finished", "Stopped"];

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function ProgramLine({
  program,
  attributions,
}: {
  program: PublicProgram;
  attributions: ProgramAttributions;
}) {
  const attribution = getCampaignAttribution(BigInt(program.id), attributions);
  const status = getProgramStatus(program).toLowerCase();
  const poolAddress = getAddress(program.distributionPool);
  const { totalFlowRate } = useProgramTotalFlowRate(poolAddress);
  const funding = formatCompactTokenAmount(BigInt(program.fundingAmount));
  const flow = totalFlowRate === undefined ? "…" : formatMonthlyFlowRate(totalFlowRate);

  return (
    <article className={styles.program}>
      <p>
        <strong>
          {attribution.names.length
            ? attribution.names.join(" / ")
            : `Program ${program.id}`}
        </strong>{" "}
        <em className="dim">{status}</em>
      </p>
      <p className={styles.metrics}>
        funded <strong>{funding} SUP</strong>
        <span>flow <strong>{flow} SUP/mo</strong></span>
      </p>
      <p className={styles.members}>
        <strong>—</strong> pool members
      </p>
      <p className="dim">
        #{program.id}
        {attribution.descriptors.length
          ? ` · ${attribution.descriptors.join(" / ")}`
          : " · unattributed"}
      </p>
      <p className="dim">
        pool{" "}
        <a
          href={`https://basescan.org/address/${poolAddress}`}
          target="_blank"
          rel="noreferrer"
        >
          {shortAddress(poolAddress)} ↗
        </a>
      </p>
    </article>
  );
}

export function Campaigns() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [attributions, setAttributions] = useState<ProgramAttributions>(
    STATIC_PROGRAM_ATTRIBUTIONS,
  );
  const [error, setError] = useState("");
  const [attributionError, setAttributionError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProgramFilter>("All");

  useEffect(() => {
    let disposed = false;
    getPublicPrograms()
      .then((result) => {
        if (!disposed) setPrograms(result);
      })
      .catch((reason) => {
        if (!disposed) setError(String(reason));
      });
    getPublicProgramAttributions()
      .then((live) => {
        if (!disposed) {
          setAttributions(
            mergeProgramAttributions(STATIC_PROGRAM_ATTRIBUTIONS, live),
          );
        }
      })
      .catch((reason) => {
        if (!disposed) {
          setAttributionError(
            `Live campaign names are unavailable; using recovered labels. ${String(reason)}`,
          );
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return programs.filter((program) => {
      const attribution = getCampaignAttribution(
        BigInt(program.id),
        attributions,
      );
      const haystack = [
        program.id,
        program.distributionPool,
        ...attribution.names,
        ...attribution.descriptors,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!needle || haystack.includes(needle)) &&
        (status === "All" || getProgramStatus(program) === status)
      );
    });
  }, [attributions, programs, query, status]);

  const counts = useMemo(
    () =>
      programs.reduce(
        (result, program) => {
          result[getProgramStatus(program)] += 1;
          return result;
        },
        { Active: 0, Finished: 0, Stopped: 0 },
      ),
    [programs],
  );

  return (
    <section className={styles.campaigns}>
      <p className={styles.summary} aria-label="Campaign summary">
        programs {programs.length || "—"} · active {counts.Active} · finished{" "}
        {counts.Finished} · stopped {counts.Stopped}
      </p>
      <p className="dim">
        funded is the total SUP allocated to a program; flow is its current pool
        distribution rate
      </p>

      <label className={styles.search}>
        <span>filter</span>
        <input
          aria-label="Filter campaigns"
          placeholder="name, ID, category, or pool"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <p className={styles.filters} aria-label="Campaign status">
        {FILTERS.map((value) => (
          <button
            className={status === value ? styles.activeFilter : undefined}
            key={value}
            type="button"
            onClick={() => setStatus(value)}
          >
            {value.toLowerCase()}
          </button>
        ))}
      </p>

      <p>
        {programs.length
          ? `${shown.length} matching program${shown.length === 1 ? "" : "s"}`
          : "loading onchain programs…"}
      </p>
      {error && <p className="status error">{error}</p>}
      {attributionError && <p className="status warning">{attributionError}</p>}

      <div className={styles.programLines}>
        {shown.map((program) => (
          <ProgramLine
            key={program.id}
            program={program}
            attributions={attributions}
          />
        ))}
      </div>
    </section>
  );
}
