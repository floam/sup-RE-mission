import type { ReactNode } from "react";

import { NavBar } from "../components/layout/NavBar";
import { VotingBanner } from "../components/layout/VotingBanner";

/**
 * Server-side cookie and font wiring was not present in the browser capture.
 * The recovered client shell retains the observable navigation/banner layout;
 * `providers/index.tsx` contains the provider topology used around this shell.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-screen-xl p-4">
          <NavBar />
          <VotingBanner />
          <main className="py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
