import { EnsSection } from "../../components/reserve/EnsSection";

const requirements = [
  "create a Reserve",
  "pay the one-time ETH fee for the selected name length",
  "claim the Reserve ENS subdomain",
];
const steps = [
  "choose a unique Reserve name",
  "confirm the one-time fee",
  "claim the ENS subdomain",
  "use the new Reserve name",
];

export default function ReserveNamesPage() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> reserve names
      </p>
      <p>
        Reserve Names are ENS subdomains such as{" "}
        <strong>alice.reserve.superfluid.eth</strong>.
      </p>

      <p><strong>requirements</strong></p>
      {requirements.map((requirement, index) => (
        <p key={requirement}>{index + 1}. {requirement}</p>
      ))}

      <p><strong>claim</strong></p>
      {steps.map((step, index) => (
        <p key={step}>{index + 1}. {step}</p>
      ))}

      <EnsSection />
    </main>
  );
}
