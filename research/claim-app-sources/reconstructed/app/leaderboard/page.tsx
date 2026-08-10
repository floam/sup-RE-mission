import { Suspense } from "react";
import { Leaderboard } from "../../components/leaderboard/Leaderboard";

export default function LeaderboardPage() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> leaderboard
      </p>
      <Suspense fallback={<p>loading leaderboard…</p>}>
        <Leaderboard />
      </Suspense>
    </main>
  );
}
