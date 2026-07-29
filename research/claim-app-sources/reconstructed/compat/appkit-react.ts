"use client";

import { useWalletDialog } from "../contexts/WalletDialogContext";

/**
 * Narrow compatibility surface for the main-branch claim experience introduced
 * after the wallet rewrite branch was created. No Reown runtime is retained.
 */
export function useAppKit() {
  const { open } = useWalletDialog();

  return {
    open({ view }: { view?: string } = {}) {
      open(view?.toLowerCase() === "account" ? "account" : "connect");
    },
  };
}
