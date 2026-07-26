import { ClaimPanel } from "../../client/ClaimPanel";
export default function Claim() {
  return (
    <main>
      <header className="hero">
        <span className="tag">Base mainnet</span>
        <h1>Claim SUP</h1>
        <p className="muted">
          Find new campaign allocations, understand what will change, and
          synchronize every update in one transaction.
        </p>
      </header>
      <ClaimPanel />
    </main>
  );
}
