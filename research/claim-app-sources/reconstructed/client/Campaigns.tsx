"use client";
import { useEffect, useMemo, useState } from "react";
import { getPublicPrograms, type PublicProgram } from "./programs";

export function Campaigns() {
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    getPublicPrograms()
      .then(setPrograms)
      .catch((e) => setError(String(e)));
  }, []);
  const shown = useMemo(
    () =>
      programs.filter(
        (p) =>
          p.id.includes(query) ||
          p.distributionPool.toLowerCase().includes(query.toLowerCase()),
      ),
    [programs, query],
  );
  return (
    <>
      <div className="toolbar">
        <input
          aria-label="Filter campaigns"
          placeholder="Program ID or pool"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted">
          {programs.length
            ? `${shown.length} of ${programs.length} programs`
            : "Loading onchain programs…"}
        </span>
      </div>
      {error && <p className="status error">{error}</p>}
      <div className="grid">
        {shown.map((p) => (
          <article className="card" key={p.id}>
            <span className="tag">Program {p.id}</span>
            <h2>
              {p.stoppedDate
                ? "Stopped"
                : Number(p.endDate) * 1000 > Date.now()
                  ? "Active"
                  : "Finished"}
            </h2>
            <p className="muted">Pool</p>
            <p style={{ overflowWrap: "anywhere" }}>{p.distributionPool}</p>
            <p className="muted">
              Funding: {p.fundingAmount} wei · Subsidy: {p.subsidyAmount} wei
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
