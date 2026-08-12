import Link from "next/link";

export default function NotFound() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> route not found
      </p>
      <p>The requested route does not exist.</p>
      <p><Link href="/">[ return home ]</Link></p>
    </main>
  );
}
