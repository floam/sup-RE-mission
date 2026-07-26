"use client";
import { useEffect, useMemo, useState } from "react";
import {
  getProgramStatus,
  getPublicPrograms,
  type PublicProgram,
} from "./programs";
import { PROGRAM_APP_DEFINITIONS } from "../data/program-app-definitions";

const appByProgram = new Map(
  PROGRAM_APP_DEFINITIONS.flatMap((app) =>
    app.program ? [[String(app.program.id), app] as const] : [],
  ),
);

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatTokenAmount(value: string) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Number(BigInt(value) / 10n ** 18n),
  );
}

export function Campaigns() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  useEffect(() => {
    getPublicPrograms()
      .then(setPrograms)
      .catch((e) => setError(String(e)));
  }, []);
  const shown = useMemo(
    () =>
      programs.filter((p) => {
        const app = appByProgram.get(p.id);
        const haystack =
          `${p.id} ${p.distributionPool} ${app?.name ?? ""} ${app?.category ?? ""}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (status === "All" || getProgramStatus(p) === status)
        );
      }),
    [programs, query, status],
  );
  const counts = useMemo(
    () => ({
      Active: programs.filter(
        (program) => getProgramStatus(program) === "Active",
      ).length,
      Finished: programs.filter(
        (program) => getProgramStatus(program) === "Finished",
      ).length,
      Stopped: programs.filter(
        (program) => getProgramStatus(program) === "Stopped",
      ).length,
    }),
    [programs],
  );
  return (
    <>
      <div className="campaign-summary">
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
      </div>
      <div className="campaign-tools">
        <input
          aria-label="Filter campaigns"
          placeholder="Search name, ID, category, or pool"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filter-pills">
          {["All", "Active", "Finished", "Stopped"].map((value) => (
            <button
              className={status === value ? "active" : ""}
              key={value}
              onClick={() => setStatus(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <p className="result-count muted">
        {programs.length
          ? `${shown.length} matching programs`
          : "Loading onchain programs…"}
      </p>
      {error && <p className="status error">{error}</p>}
      <div className="campaign-table-wrap">
        <table className="campaign-table">
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
            {shown.map((p) => {
              const app = appByProgram.get(p.id);
              const programStatus = getProgramStatus(p);
              return (
                <tr key={p.id}>
                  <td data-label="Campaign">
                    <strong>{app?.name ?? `Program ${p.id}`}</strong>
                    <small>
                      {app
                        ? `Season ${app.season ?? "—"} · ${app.category} · #${p.id}`
                        : `Unattributed · #${p.id}`}
                    </small>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`state-pill ${programStatus.toLowerCase()}`}
                    >
                      {programStatus}
                    </span>
                  </td>
                  <td data-label="Funding">
                    {formatTokenAmount(p.fundingAmount)} SUP
                  </td>
                  <td data-label="Subsidy">
                    {formatTokenAmount(p.subsidyAmount)} SUP
                  </td>
                  <td data-label="Pool">
                    <a
                      className="pool-link"
                      href={`https://basescan.org/address/${p.distributionPool}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(p.distributionPool)} ↗
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
