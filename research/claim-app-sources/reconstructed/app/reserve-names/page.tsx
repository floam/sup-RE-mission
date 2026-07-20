import { EnsSection } from "../../components/reserve/EnsSection";

const requirements = [
  "Have created a reserve",
  "Pay a one-time ETH fee (based on name length)",
  "Thats it! You are eligible to claim a name for your Reserve",
];
const steps = [
  "Choose your unique Reserve name",
  "Confirm and pay the one-time fee",
  "Claim your ENS subdomain",
  "Start using your new Reserve name!",
];

export default function ReserveNamesPage() {
  return (
    <main className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section className="rounded-xl bg-green-superdark p-8 text-white">
        <p className="uppercase">Claim your reserve identity</p>
        <h1 className="text-h3 text-green-sf">Reserve Names</h1>
        <p>
          Reserve Names are ENS subdomains that make it easy to identify and
          share your Reserve address. Instead of sharing a long wallet address,
          you can share your unique Reserve name like{" "}
          <strong>alice.reserve.superfluid.eth</strong>.
        </p>
        <h2 className="mt-8">Eligibility Requirements:</h2>
        <ol>
          {requirements.map((requirement, index) => (
            <li key={requirement}>
              {index + 1}. {requirement}
            </li>
          ))}
        </ol>
        <p className="mt-6">
          Once you claim your name, it&apos;s <mark>yours forever</mark>! You
          can use it to look up and identify your Reserve, share it with others
          and more.
        </p>
        <h2 className="mt-8">How to Claim:</h2>
        <ol>
          {steps.map((step, index) => (
            <li key={step}>
              {index + 1}. {step}
            </li>
          ))}
        </ol>
      </section>
      <EnsSection />
    </main>
  );
}
