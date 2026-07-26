import { Campaigns } from "../../client/Campaigns";
export default function Apps() {
  return (
    <main>
      <header className="hero">
        <span className="tag">Live subgraph</span>
        <h1>Campaigns</h1>
        <p className="muted">
          Onchain SUP emission programs, loaded directly in this browser.
        </p>
      </header>
      <Campaigns />
    </main>
  );
}
