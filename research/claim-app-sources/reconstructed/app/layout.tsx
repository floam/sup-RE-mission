import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import "./globals.css";
import "./wallet-dialog.css";

import { NavConnectAndBalance } from "../components/layout/NavConnectAndBalance";
import { NavFeatureLinks } from "../components/layout/NavFeatureLinks";
import { ReserveBalanceBar } from "../components/layout/ReserveBalanceBar";
import { RootProviders } from "../providers/RootProviders";

export const metadata: Metadata = {
  title: "sup re:claim",
  description: "Independent Superfluid claim review client",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieHeader = (await headers()).get("cookie");

  return (
    <html lang="en" className="dark">
      <body>
        <Suspense fallback={<div className="shell">loading…</div>}>
          <RootProviders cookies={cookieHeader}>
            <div className="shell">
              <nav aria-label="Primary navigation">
                <Link className="brand" href="/">
                  sup re:claim
                </Link>
                <div className="links">
                  <NavFeatureLinks />
                  <NavConnectAndBalance />
                </div>
              </nav>
              <ReserveBalanceBar />
              {children}
            </div>
          </RootProviders>
        </Suspense>
      </body>
    </html>
  );
}
