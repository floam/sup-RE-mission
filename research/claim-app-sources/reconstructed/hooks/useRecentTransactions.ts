"use client";

import { useSyncExternalStore } from "react";

import type { RecentTransaction } from "../types/transactions";

let transactions: RecentTransaction[] = [];
const listeners = new Set<() => void>();

export function recordRecentTransaction(transaction: RecentTransaction): void {
  transactions = [...transactions, transaction].slice(-50);
  listeners.forEach((listener) => listener());
}

export function useRecentTransactions(
  type: string,
  maxAgeSeconds: number,
): RecentTransaction[] {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => transactions,
    () => transactions,
  );
  const cutoff = Date.now() - maxAgeSeconds * 1_000;
  return snapshot.filter(
    (transaction) =>
      transaction.type === type && transaction.timestamp >= cutoff,
  );
}
