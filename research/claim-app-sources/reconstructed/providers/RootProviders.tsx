"use client";

import type { PropsWithChildren } from "react";
import { wagmiConfig } from "../config/wallet";
import { ContextProvider } from "./index";

export function RootProviders({
  children,
  cookies,
}: PropsWithChildren<{ cookies?: string | null }>) {
  return (
    <ContextProvider cookies={cookies} wagmiConfig={wagmiConfig}>
      {children}
    </ContextProvider>
  );
}
