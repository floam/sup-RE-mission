import { ClaimPanel } from "../../client/ClaimPanel";

export default function Claim() {
  return (
    <main>
      <header className="hero">
        <span className="tag">Base mainnet</span>
        <h1>Claim SUP</h1>
        <p className="muted">
          Review your campaign allocation targets, see how they compare onchain,
          and apply any eligible changes in one transaction.
        </p>
      </header>
      <ClaimPanel />
    </main>
  );
}
