import { Campaigns } from "../../client/Campaigns";

export default function Apps() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> campaigns
      </p>
      <Campaigns />
    </main>
  );
}
