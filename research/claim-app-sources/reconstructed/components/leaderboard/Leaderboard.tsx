"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
} from "lucide-react";
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
    <div className="flex flex-col gap-4 rounded-lg bg-platinum p-5">
      <div className="flex items-center gap-2">
        <input
          data-testid="search-input"
          placeholder="Search for users..."
          className="h-10 flex-1 border-[#E4EAF5] bg-white shadow-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="h-auto p-2">
          <Search size={24} />
        </button>
      </div>
      <div className="flex flex-col gap-3 md:gap-4">
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
        {isLoading &&
          Array.from({ length: yourEntry ? 4 : 5 }, (_, index) => (
            <div
              key={index}
              className="h-20 w-full animate-pulse rounded-md bg-gray-200"
            />
          ))}
      </div>
      {!searched?.entry && pageCount > 0 && (
        <nav aria-label="pagination" className="flex justify-end gap-1">
          {currentPage !== 1 && (
            <>
              <Link data-testid="pagination-start" href="/leaderboard?p=1">
                <ChevronsLeft />
              </Link>
              <Link
                data-testid="pagination-previous"
                href={`/leaderboard?p=${Math.max(1, currentPage - 1)}`}
              >
                <ChevronLeft />
              </Link>
            </>
          )}
          {pages.map((page) => (
            <Link
              key={page}
              data-testid={
                page === currentPage
                  ? "pagination-link-active"
                  : "pagination-link"
              }
              aria-current={page === currentPage ? "page" : undefined}
              className={page === currentPage ? "bg-green text-white" : ""}
              href={`/leaderboard?p=${page}`}
            >
              {page}
            </Link>
          ))}
          {currentPage !== pageCount && (
            <>
              <Link
                data-testid="pagination-next"
                href={`/leaderboard?p=${Math.min(pageCount, currentPage + 1)}`}
              >
                <ChevronRight />
              </Link>
              <Link
                data-testid="pagination-end"
                href={`/leaderboard?p=${pageCount}`}
              >
                <ChevronsRight />
              </Link>
            </>
          )}
        </nav>
      )}
    </div>
  );
}
