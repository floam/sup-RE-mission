import { ConnectedHideGuard } from "../../components/governance/ConnectedHideGuard";
import { EditDelegateButton } from "../../components/governance/EditDelegateButton";
import { TotalDelegated } from "../../components/governance/TotalDelegated";
import { TotalMembers } from "../../components/governance/TotalMembers";
import { YourDelegate } from "../../components/governance/YourDelegate";
import { YourVotingPower } from "../../components/governance/YourVotingPower";

export default function GovernancePage() {
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-h2">Governance</h1>
        <p>
          Delegate your SUP voting power and participate in Superfluid
          governance.
        </p>
      </header>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-green-superdark p-6 text-white">
          <div className="text-green-sf uppercase">Total Members</div>
          <strong className="text-h5">
            <TotalMembers />
          </strong>
        </div>
        <div className="rounded-lg bg-[#21014d] p-6 text-white">
          <div className="text-pink uppercase">Total SUP Delegated</div>
          <strong data-testid="total-delegated" className="text-h5">
            <TotalDelegated />
          </strong>
        </div>
        <div className="rounded-lg bg-violet-dark p-6 text-white">
          <div className="text-violet-light uppercase">Your Voting Power</div>
          <strong className="text-h5">
            <ConnectedHideGuard>
              <span>
                <YourVotingPower />
              </span>
            </ConnectedHideGuard>
          </strong>
        </div>
        <div className="rounded-lg bg-platinum p-6">
          <div className="flex items-center justify-between">
            <span className="text-purple uppercase">Your Delegate</span>
            <EditDelegateButton />
          </div>
          <strong className="text-h5">
            <ConnectedHideGuard>
              <span>
                <YourDelegate />
              </span>
            </ConnectedHideGuard>
          </strong>
        </div>
      </section>
    </main>
  );
}
