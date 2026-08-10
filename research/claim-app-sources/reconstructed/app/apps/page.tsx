import { Campaigns } from "../../client/Campaigns";

export default function Apps() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> campaigns
      </p>
      <p className="dim">
        onchain SUP emission programs loaded directly in this browser
      </p>
      <Campaigns />
    </main>
  );
}
