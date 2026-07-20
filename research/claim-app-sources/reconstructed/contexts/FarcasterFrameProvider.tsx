"use client";

import { sdk } from "@farcaster/frame-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from "react";

interface FarcasterFrameSnapshot {
  context: Awaited<typeof sdk.context> | null;
  isInMiniApp: boolean;
  isMiniAppAdded: boolean;
}

interface FarcasterFrameState extends FarcasterFrameSnapshot {
  isMiniAppLoading: boolean;
}

const FarcasterFrameContext = createContext<FarcasterFrameState>({
  context: null,
  isInMiniApp: false,
  isMiniAppAdded: false,
  isMiniAppLoading: true,
});

async function getFarcasterFrameSnapshot(): Promise<FarcasterFrameSnapshot> {
  await sdk.actions.ready();
  const isInMiniApp = await sdk.isInMiniApp();
  const context = isInMiniApp ? await sdk.context : null;
  return {
    isInMiniApp,
    context,
    isMiniAppAdded: context?.client?.added ?? false,
  };
}

function getFarcasterFrameSnapshotWithTimeout() {
  const fallback: FarcasterFrameSnapshot = {
    isInMiniApp: false,
    isMiniAppAdded: false,
    context: null,
  };
  return Promise.race([
    getFarcasterFrameSnapshot(),
    new Promise<FarcasterFrameSnapshot>((resolve) =>
      setTimeout(() => resolve(fallback), 5_000),
    ),
  ]);
}

async function addFarcasterMiniApp() {
  await sdk.actions.addMiniApp();
}

export function FarcasterFrameProvider({ children }: PropsWithChildren) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["farcaster-frame-context"],
    queryFn: getFarcasterFrameSnapshotWithTimeout,
  });
  const addMiniApp = useMutation({
    mutationFn: addFarcasterMiniApp,
    onSuccess: () => {
      void refetch();
    },
  });
  useEffect(() => {
    if (data?.isInMiniApp) addMiniApp.mutate();
  }, [data?.isInMiniApp]);
  const value: FarcasterFrameState = {
    context: data?.context ?? null,
    isInMiniApp: Boolean(data?.isInMiniApp),
    isMiniAppAdded: Boolean(data?.isMiniAppAdded),
    isMiniAppLoading: isLoading,
  };
  return (
    <FarcasterFrameContext.Provider value={value}>
      {children}
    </FarcasterFrameContext.Provider>
  );
}

export function useFarcasterFrame(): FarcasterFrameState {
  return useContext(FarcasterFrameContext);
}
