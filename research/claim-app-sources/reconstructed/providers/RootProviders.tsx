"use client";

import type { PropsWithChildren } from "react";
import { wagmiAdapter } from "../config/wallet";
import { ContextProvider } from "./index";

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <ContextProvider wagmiConfig={wagmiAdapter.wagmiConfig}>
      {children}
    </ContextProvider>
  );
}
