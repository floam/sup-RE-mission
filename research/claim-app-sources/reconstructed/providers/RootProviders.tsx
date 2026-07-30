"use client";

import type { PropsWithChildren } from "react";
import { wagmiConfig } from "../config/wallet";
import { ContextProvider } from "./index";

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <ContextProvider wagmiConfig={wagmiConfig}>{children}</ContextProvider>
  );
}
