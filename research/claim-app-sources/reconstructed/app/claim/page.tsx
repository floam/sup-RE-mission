import { ClaimPanel } from "../../client/ClaimPanel";
export default function Claim() {
  return (
    <main>
      <header className="hero">
        <span className="tag">Base mainnet</span>
        <h1>Claim SUP</h1>
        <p className="muted">
          Inspect points, compare them with your onchain units, and submit the
          recovered locker claim.
        </p>
      </header>
      <ClaimPanel />
    </main>
  );
}
