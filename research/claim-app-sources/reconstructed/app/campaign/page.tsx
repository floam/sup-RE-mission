import { Campaigns } from "../../client/Campaigns";

export default function Campaign() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> campaign history
      </p>
      <Campaigns />
    </main>
  );
}
