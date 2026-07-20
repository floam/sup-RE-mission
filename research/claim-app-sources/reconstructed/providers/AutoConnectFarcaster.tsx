"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";

import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";

const RETRY_DELAYS_MS = [
  1_000, 2_000, 3_000, 5_000, 8_000, 13_000, 21_000, 34_000, 55_000, 89_000,
] as const;

export function AutoConnectFarcaster() {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const attempt = useRef(0);
  useEffect(() => {
    if (!isInMiniApp || isMiniAppLoading || isConnected) {
      attempt.current = 0;
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tryConnect = () => {
      if (attempt.current >= 10) return;
      const connector = connectors.find(
        (candidate) =>
          candidate.id === "farcaster" ||
          candidate.type === "farcasterMiniApp" ||
          candidate.name.toLowerCase().includes("farcaster"),
      );
      if (connector) connect({ connector });
      const delay = RETRY_DELAYS_MS[attempt.current] ?? RETRY_DELAYS_MS.at(-1)!;
      attempt.current += 1;
      if (attempt.current < 10) timer = setTimeout(tryConnect, delay);
    };
    tryConnect();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [connect, connectors, isConnected, isInMiniApp, isMiniAppLoading]);
  return null;
}
