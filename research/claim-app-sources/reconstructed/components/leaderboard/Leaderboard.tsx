"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAddress } from "viem";

import { useLocker } from "../../contexts/LockerContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useLeaderboardEntry } from "../../hooks/useLeaderboardEntry";
import { API_ENDPOINTS } from "../../lib/endpoints";
import type { LeaderboardEntry } from "../../types/program-app";
import { LeaderboardEntryCard } from "./LeaderboardEntryCard";

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  pagination: { total: number };
}

export function Leaderboard() {
  const currentPage = Number(useSearchParams().get("p") || "1");
  const pageSize = 10;
  const { data, isLoading } = useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard", currentPage, pageSize],
    queryFn: async () =>
      (await fetch(API_ENDPOINTS.leaderboard(currentPage, pageSize))).json(),
  });
  const pageCount = Math.ceil((data?.pagination?.total ?? 0) / pageSize);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 500);
  const searchAddress = isAddress(search) ? search : debounced;
  const { data: searched } = useLeaderboardEntry({
    address: isAddress(searchAddress) ? searchAddress : undefined,
  });
  const { accountAddress, lockerAddress } = useLocker();
  const { data: connected } = useLeaderboardEntry({
    address: accountAddress,
    enabled: Boolean(lockerAddress),
  });

  const { yourEntry, visibleEntries } = useMemo(() => {
    const entries = data?.entries ?? [];
    return {
      yourEntry: connected?.entry ?? null,
      visibleEntries: (searched?.entry ? [searched.entry] : entries).filter(
        (entry) =>
          entry.accountAddress.toLowerCase() !== accountAddress?.toLowerCase(),
      ),
    };
  }, [accountAddress, connected?.entry, data?.entries, searched?.entry]);
  const pages = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => currentPage - 2 + index).filter(
        (page) => page >= 1 && page <= pageCount,
      ),
    [currentPage, pageCount],
  );

  return (
    <section aria-label="Leaderboard entries">
      <label className="account-field">
        <span>address</span>
        <input
          data-testid="search-input"
          placeholder="0x…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <p className="dim">
        rank · account · monthly SUP flow
      </p>
      <div className="leaderboard-lines">
        {yourEntry && (
          <LeaderboardEntryCard
            dataTestId="leaderboard-entry"
            entry={yourEntry}
            isYou
          />
        )}
        {visibleEntries.map((entry) => (
          <LeaderboardEntryCard
            key={entry.accountAddress}
            dataTestId="leaderboard-entry"
            entry={entry}
            isYou={false}
          />
        ))}
        {isLoading && <p className="dim">loading entries…</p>}
        {!isLoading && !yourEntry && visibleEntries.length === 0 && (
          <p className="dim">no entries found</p>
        )}
      </div>

      {!searched?.entry && pageCount > 0 && (
        <p aria-label="pagination">
          {currentPage !== 1 && (
            <>
              <Link data-testid="pagination-start" href="/leaderboard?p=1">
                [ first ]
              </Link>{" "}
              <Link
                data-testid="pagination-previous"
                href={`/leaderboard?p=${Math.max(1, currentPage - 1)}`}
              >
                [ previous ]
              </Link>{" "}
            </>
          )}
          {pages.map((page) => (
            <span key={page}>
              <Link
                data-testid={
                  page === currentPage
                    ? "pagination-link-active"
                    : "pagination-link"
                }
                aria-current={page === currentPage ? "page" : undefined}
                className={page === currentPage ? "positive" : undefined}
                href={`/leaderboard?p=${page}`}
              >
                [{page}]
              </Link>{" "}
            </span>
          ))}
          {currentPage !== pageCount && (
            <>
              <Link
                data-testid="pagination-next"
                href={`/leaderboard?p=${Math.min(pageCount, currentPage + 1)}`}
              >
                [ next ]
              </Link>{" "}
              <Link
                data-testid="pagination-end"
                href={`/leaderboard?p=${pageCount}`}
              >
                [ last ]
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
