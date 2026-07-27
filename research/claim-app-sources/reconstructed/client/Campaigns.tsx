"use client";

import { useEffect, useMemo, useState } from "react";

import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";
import styles from "./Campaigns.module.css";
import {
  getProgramStatus,
  getPublicPrograms,
  type PublicProgram,
} from "./programs";

type ProgramAppDefinition = (typeof PROGRAM_APP_DEFINITIONS)[number];
type ProgramStatus = ReturnType<typeof getProgramStatus>;
type ProgramFilter = ProgramStatus | "All";

const appsByProgram = new Map<string, ProgramAppDefinition[]>();
for (const app of PROGRAM_APP_DEFINITIONS) {
  if (!app.program) continue;
  const programId = String(app.program.id);
  appsByProgram.set(programId, [...(appsByProgram.get(programId) ?? []), app]);
}

const FILTERS: ProgramFilter[] = ["All", "Active", "Finished", "Stopped"];

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatTokenAmount(value: string) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Number(BigInt(value) / 10n ** 18n),
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function getAttribution(programId: string) {
  const apps = appsByProgram.get(programId) ?? [];
  return {
    names: unique(apps.map((app) => app.name)),
    descriptors: unique(
      apps.map((app) => `Season ${app.season ?? "—"} · ${app.category}`),
    ),
  };
}

export function Campaigns() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProgramFilter>("All");

  useEffect(() => {
    getPublicPrograms()
      .then(setPrograms)
      .catch((reason) => setError(String(reason)));
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return programs.filter((program) => {
      const attribution = getAttribution(program.id);
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
  }, [programs, query, status]);

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
    <>
      <section className={styles.summary} aria-label="Campaign summary">
        <div>
          <span>Programs</span>
          <strong>{programs.length || "—"}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{counts.Active}</strong>
        </div>
        <div>
          <span>Finished</span>
          <strong>{counts.Finished}</strong>
        </div>
        <div>
          <span>Stopped</span>
          <strong>{counts.Stopped}</strong>
        </div>
      </section>

      <div className={styles.tools}>
        <input
          aria-label="Filter campaigns"
          placeholder="Search name, ID, category, or pool"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className={styles.filters} aria-label="Campaign status">
          {FILTERS.map((value) => (
            <button
              className={status === value ? styles.activeFilter : undefined}
              key={value}
              type="button"
              onClick={() => setStatus(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <p className="muted">
        {programs.length
          ? `${shown.length} matching program${shown.length === 1 ? "" : "s"}`
          : "Loading onchain programs…"}
      </p>
      {error && <p className="status error">{error}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Funding</th>
              <th>Subsidy</th>
              <th>Pool</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((program) => {
              const attribution = getAttribution(program.id);
              const programStatus = getProgramStatus(program);
              return (
                <tr key={program.id}>
                  <td data-label="Campaign">
                    <strong>
                      {attribution.names.length
                        ? attribution.names.join(" / ")
                        : `Program ${program.id}`}
                    </strong>
                    <small>
                      {attribution.descriptors.length
                        ? `${attribution.descriptors.join(" / ")} · #${program.id}`
                        : `Unattributed · #${program.id}`}
                    </small>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`${styles.statusPill} ${styles[programStatus.toLowerCase()]}`}
                    >
                      {programStatus}
                    </span>
                  </td>
                  <td data-label="Funding">
                    {formatTokenAmount(program.fundingAmount)} SUP
                  </td>
                  <td data-label="Subsidy">
                    {formatTokenAmount(program.subsidyAmount)} SUP
                  </td>
                  <td data-label="Pool">
                    <a
                      className={styles.poolLink}
                      href={`https://basescan.org/address/${program.distributionPool}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(program.distributionPool)} ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
