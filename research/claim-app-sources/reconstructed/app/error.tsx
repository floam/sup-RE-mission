"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  return (
    <main className="terminal-page" role="alert">
      <p className="command-line">
        <span className="negative">!</span> route error
      </p>
      <p>{error.message || "The route could not continue."}</p>
      {error.digest && <p className="dim">digest {error.digest}</p>}
      <p><button type="button" onClick={reset}>[ retry ]</button></p>
    </main>
  );
}
