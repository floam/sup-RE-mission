"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#000",
          color: "#f4f4f4",
          fontFamily:
            'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
          fontSize: "16px",
          lineHeight: 1.5,
        }}
      >
        <main style={{ width: "min(76ch, 100%)", margin: "0 auto" }}>
          <p>&gt; application error</p>
          <p>{error.message || "The application could not continue."}</p>
          {error.digest && <p style={{ color: "#858585" }}>digest {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              padding: "0 1ch",
              background: "#f4f4f4",
              color: "#000",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            [ retry ]
          </button>
        </main>
      </body>
    </html>
  );
}
