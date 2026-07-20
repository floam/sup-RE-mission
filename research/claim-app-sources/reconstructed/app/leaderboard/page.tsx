import { Leaderboard } from "../../components/leaderboard/Leaderboard";

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="-z-10 absolute top-0 left-0 h-full w-full bg-[url('/leaderboard-bg.svg')] bg-center bg-cover" />
      <Leaderboard />
    </div>
  );
}
