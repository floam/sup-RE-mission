import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import "./recovered.css";
import "./globals.css";

import { NavConnectAndBalance } from "../components/layout/NavConnectAndBalance";
import { RootProviders } from "../providers/RootProviders";

export const metadata: Metadata = {
  title: "SUP Re:Claim",
  description: "Recovered Superfluid claim app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Suspense fallback={<div className="shell">Loading application…</div>}>
          <RootProviders>
            <div className="shell">
              <nav>
                <Link className="brand" href="/">
                  SUP Re:Claim
                </Link>
                <div className="links">
                  <Link href="/claim">Claim</Link>
                  <Link href="/apps">Campaigns</Link>
                  <NavConnectAndBalance />
                </div>
              </nav>
              {children}
            </div>
          </RootProviders>
        </Suspense>
      </body>
    </html>
  );
}
