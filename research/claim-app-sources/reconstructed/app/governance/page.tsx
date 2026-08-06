import { ConnectedHideGuard } from "../../components/governance/ConnectedHideGuard";
import { EditDelegateButton } from "../../components/governance/EditDelegateButton";
import { TotalDelegated } from "../../components/governance/TotalDelegated";
import { TotalMembers } from "../../components/governance/TotalMembers";
import { YourDelegate } from "../../components/governance/YourDelegate";
import { YourVotingPower } from "../../components/governance/YourVotingPower";

export default function GovernancePage() {
  return (
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> governance
      </p>
      <p>delegate SUP voting power and inspect governance state</p>
      <div className="route-lines">
        <p className="route-line">
          <strong>total members</strong>
          <span><TotalMembers /></span>
        </p>
        <p className="route-line">
          <strong>SUP delegated</strong>
          <span data-testid="total-delegated"><TotalDelegated /></span>
        </p>
        <p className="route-line">
          <strong>voting power</strong>
          <ConnectedHideGuard><span><YourVotingPower /></span></ConnectedHideGuard>
        </p>
        <p className="route-line">
          <strong>delegate</strong>
          <span>
            <ConnectedHideGuard><span><YourDelegate /></span></ConnectedHideGuard>{" "}
            <EditDelegateButton />
          </span>
        </p>
      </div>
    </main>
  );
}
