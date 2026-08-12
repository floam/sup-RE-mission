"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { useFarcasterFrame } from "./FarcasterFrameProvider";

type WalletView = "connect" | "account";

const WalletDialogContext = createContext<{
  open(view?: WalletView): void;
}>({ open: () => undefined });

function connectorLabel(name: string) {
  const labels: Record<string, string> = {
    FarcasterInjected: "Farcaster",
    Injected: "Browser wallet",
  };
  return labels[name] ?? name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function WalletDialogProvider({ children }: PropsWithChildren) {
  const [view, setView] = useState<WalletView | null>(null);
  const { address } = useAccount();
  const { connectors, connect, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isInMiniApp } = useFarcasterFrame();
  const visibleConnectors = connectors.filter(
    (connector) => connector.type !== "farcasterMiniApp" || isInMiniApp,
  );

  useEffect(() => {
    if (!view) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setView(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [view]);

  return (
    <WalletDialogContext.Provider
      value={{ open: (nextView = "connect") => setView(nextView) }}
    >
      {children}
      {view && (
        <div
          className="wallet-dialog-overlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setView(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            className="wallet-dialog"
          >
            <p className="wallet-dialog-heading">
              <strong id="wallet-dialog-title">
                <span className="prompt">&gt;</span>{" "}
                {view === "account" && address ? "wallet" : "connect wallet"}
              </strong>
              <button
                className="wallet-dialog-close"
                aria-label="Close wallet dialog"
                onClick={() => setView(null)}
              >
                [ close ]
              </button>
            </p>

            {view === "account" && address ? (
              <div className="wallet-dialog-body">
                <p className="wallet-dialog-address">{address}</p>
                <p>
                  <button
                    onClick={() => {
                      disconnect();
                      setView(null);
                    }}
                  >
                    [ disconnect ]
                  </button>
                </p>
              </div>
            ) : (
              <div className="wallet-dialog-body">
                <p className="dim">select a connector</p>
                <div
                  className="wallet-connector-list"
                  aria-label="Wallet connectors"
                >
                  {visibleConnectors.map((connector, index) => (
                    <button
                      className="wallet-connector"
                      key={connector.uid}
                      disabled={isPending}
                      onClick={() =>
                        connect(
                          { connector },
                          { onSuccess: () => setView(null) },
                        )
                      }
                    >
                      <span className="wallet-connector-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{connectorLabel(connector.name)}</span>
                    </button>
                  ))}
                </div>
                {error && (
                  <p className="wallet-dialog-error" role="alert">
                    {error.message}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </WalletDialogContext.Provider>
  );
}

export function useWalletDialog() {
  return useContext(WalletDialogContext);
}
