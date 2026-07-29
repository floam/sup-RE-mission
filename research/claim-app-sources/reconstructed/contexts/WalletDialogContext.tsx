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
        <div className="wallet-dialog-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            className="wallet-dialog"
          >
            <button
              className="wallet-dialog-close"
              aria-label="Close wallet dialog"
              onClick={() => setView(null)}
            >
              ×
            </button>
            {view === "account" && address ? (
              <>
                <h2 id="wallet-dialog-title">Wallet</h2>
                <p className="wallet-dialog-address">{address}</p>
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
                <h2 id="wallet-dialog-title">Connect wallet</h2>
                <div className="flex flex-col gap-2">
                  {connectors.map((connector) => (
                    <button
                      key={connector.uid}
                      disabled={isPending}
                      onClick={() =>
                        connect(
                          { connector },
                          { onSuccess: () => setView(null) },
                        )
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
        </div>
      )}
    </WalletDialogContext.Provider>
  );
}

export function useWalletDialog() {
  return useContext(WalletDialogContext);
}
