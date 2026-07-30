"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

type WalletView = "connect" | "account";

const WalletDialogContext = createContext<{
  open(view?: WalletView): void;
}>({ open: () => undefined });

export function WalletDialogProvider({ children }: PropsWithChildren) {
  const [view, setView] = useState<WalletView | null>(null);
  const { address } = useAccount();
  const { connectors, connect, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <WalletDialogContext.Provider
      value={{ open: (nextView = "connect") => setView(nextView) }}
    >
      {children}
      {view && (
        <div role="dialog" aria-modal="true" className="modal">
          <button
            aria-label="Close wallet dialog"
            onClick={() => setView(null)}
          >
            ×
          </button>
          {view === "account" && address ? (
            <>
              <h2>Wallet</h2>
              <p>{address}</p>
              <button
                onClick={() => {
                  disconnect();
                  setView(null);
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <h2>Connect wallet</h2>
              <div className="flex flex-col gap-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    disabled={isPending}
                    onClick={() =>
                      connect({ connector }, { onSuccess: () => setView(null) })
                    }
                  >
                    {connector.name}
                  </button>
                ))}
              </div>
              {error && <p className="text-sm">{error.message}</p>}
            </>
          )}
        </div>
      )}
    </WalletDialogContext.Provider>
  );
}

export function useWalletDialog() {
  return useContext(WalletDialogContext);
}
