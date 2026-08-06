import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import "./globals.css";
import "./wallet-dialog.css";

import { NavConnectAndBalance } from "../components/layout/NavConnectAndBalance";
import { RootProviders } from "../providers/RootProviders";

export const metadata: Metadata = {
  title: "SUP Re:Mission",
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
                  sup re:mission
                </Link>
                <div className="links">
                  <Link href="/claim">claim</Link>
                  <Link href="/apps">campaigns</Link>
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
