import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import "./recovered.css";
import "./globals.css";
import "./wallet-dialog.css";

import { NavConnectAndBalance } from "../components/layout/NavConnectAndBalance";
import { RootProviders } from "../providers/RootProviders";

export const metadata: Metadata = {
  title: "SUP Re:Claim",
  description: "Recovered Superfluid claim app",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieHeader = (await headers()).get("cookie");

  return (
    <html lang="en" className="dark">
      <body>
        <Suspense fallback={<div className="shell">Loading application…</div>}>
          <RootProviders cookies={cookieHeader}>
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
