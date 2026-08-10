"use client";

import Link from "next/link";

import { ConnectButton } from "../components/layout/ConnectButton";
import { useWalletAccount } from "../hooks/useWalletAccount";

const routes = [
  ["claim", "/claim", "review campaign deltas and update the SUP stream"],
  ["campaigns", "/apps", "inspect public SUP campaign programs"],
  ["reserve", "/reserve", "create and inspect a Superfluid Reserve"],
  ["leaderboard", "/leaderboard", "review campaign standings"],
  ["governance", "/governance", "inspect governance state"],
  ["liquidity", "/liquidity", "review liquidity positions"],
  ["staking", "/staking", "review SUP staking"],
  ["reserve names", "/reserve-names", "inspect Reserve naming"],
] as const;

export default function Home() {
  const { isConnected } = useWalletAccount();

  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> independent Superfluid client
      </p>
      <p className="dim">
        public campaign data, direct chain reads, and wallet-controlled claims
      </p>

      {isConnected ? (
        <>
          <div className="route-lines" aria-label="Application routes">
            {routes.map(([label, href, description]) => (
              <p className="route-line" key={href}>
                <Link href={href}>{label}</Link>
                <span className="dim">{description}</span>
              </p>
            ))}
          </div>

          <p className="dim">
            read operations run in the browser; claim vouchers are requested only
            when a selected update is submitted
          </p>
        </>
      ) : (
        <section className="home-connect" aria-label="Connect a wallet">
          <p>Connect a wallet to open the SUP workbench.</p>
          <p><ConnectButton /></p>
        </section>
      )}
    </main>
  );
}
