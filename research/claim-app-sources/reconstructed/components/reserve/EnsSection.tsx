"use client";

import Link from "next/link";
import { useState } from "react";
import { useBalance } from "wagmi";

import { APP_CHAIN } from "../../config/chains";
import { useLocker } from "../../contexts/LockerContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  getReserveNameFee,
  useReserveNameRegistration,
  validateReserveSubdomain,
} from "../../hooks/useReserveNameRegistration";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { LoadingText } from "../layout/LoadingText";
import { SignUpToParticipateButton } from "../SignUpToParticipateButton";
import { TransactionButton } from "../TransactionButton";

export function EnsSection() {
  const { accountAddress, isLockerCreated } = useLocker();
  const wallet = useWalletAccount();
  const [subdomain, setSubdomain] = useState("");
  const debouncedSubdomain = useDebouncedValue(subdomain.toLowerCase(), 500);
  const registration = useReserveNameRegistration({
    accountAddress,
    subdomain: debouncedSubdomain,
  });

  if (wallet.isConnecting || wallet.isReconnecting) return <LoadingState />;
  if (!wallet.isConnected) return <ConnectWalletState />;
  if (!isLockerCreated) return <CreateReserveState />;
  if (registration.hasExistingSubdomain) {
    return <SuccessState ensName={registration.userEnsName} />;
  }
  return (
    <RegisterState
      accountAddress={accountAddress}
      subdomain={subdomain}
      setSubdomain={setSubdomain}
      debouncedSubdomain={debouncedSubdomain}
      registration={registration}
    />
  );
}

function LoadingState() {
  return (
    <p className="dim">
      <LoadingText loading>loading Reserve name state</LoadingText>
    </p>
  );
}

function ConnectWalletState() {
  return (
    <section>
      <p>Connect the wallet that owns the Reserve.</p>
      <SignUpToParticipateButton buttonText="[ connect wallet ]" />
    </section>
  );
}

function CreateReserveState() {
  return (
    <section>
      <p>Create a Reserve before claiming its ENS subdomain.</p>
      <p><Link href="/reserve">[ create Reserve ]</Link></p>
    </section>
  );
}

function RegisterState({
  accountAddress,
  subdomain,
  setSubdomain,
  debouncedSubdomain,
  registration,
}: {
  accountAddress: ReturnType<typeof useLocker>["accountAddress"];
  subdomain: string;
  setSubdomain(value: string): void;
  debouncedSubdomain: string;
  registration: ReturnType<typeof useReserveNameRegistration>;
}) {
  const validation = validateReserveSubdomain(subdomain);
  const availabilityLoading =
    debouncedSubdomain !== subdomain ||
    (validation.isValid && registration.readSubdomainAvailability.isFetching);
  const fee = getReserveNameFee(subdomain);
  const balance = useBalance({
    address: accountAddress,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(accountAddress) },
  });
  const hasSufficientEth = !balance.data || balance.data.value >= fee;
  const canRegister = Boolean(
    validation.isValid &&
    registration.isAvailable &&
    debouncedSubdomain === subdomain &&
    !registration.isFinished &&
    !registration.status?.isLoading &&
    hasSufficientEth,
  );
  const success = Boolean(
    registration.status?.isFinished && !registration.status.isError,
  );
  if (success)
    return <SuccessState ensName={`${subdomain}.reserve.superfluid.eth`} />;

  const feeLabel = subdomain ? `${Number(fee) / 1e18} ETH` : "";
  let buttonLabel = "[ claim Reserve name ]";
  if (!validation.isValid && subdomain) buttonLabel = "invalid name";
  else if (validation.isValid && !hasSufficientEth)
    buttonLabel = "insufficient ETH";
  else if (registration.status?.isLoading)
    buttonLabel = registration.status.displayText;
  else if (
    validation.isValid &&
    registration.isAvailable &&
    debouncedSubdomain === subdomain &&
    !availabilityLoading
  )
    buttonLabel = `[ claim for ${feeLabel} ]`;
  else if (
    validation.isValid &&
    !registration.isAvailable &&
    debouncedSubdomain === subdomain &&
    !availabilityLoading
  )
    buttonLabel = "name unavailable";

  return (
    <section aria-label="Reserve name registration">
      <label className="account-field">
        <span>name</span>
        <input
          type="text"
          placeholder="mynamehere"
          value={subdomain}
          onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
        />
      </label>
      <p className="dim">
        {subdomain || "mynamehere"}.reserve.superfluid.eth
        {availabilityLoading && validation.isValid ? " · checking…" : ""}
      </p>
      <p>
        one-time fee {feeLabel || "depends on name length"} · no renewal
      </p>
      <TransactionButton
        dataTestId="register-ens-name-button"
        chain={APP_CHAIN}
        onClick={registration.register}
        status={registration.status}
        ButtonProps={{ disabled: !canRegister }}
      >
        {buttonLabel}
      </TransactionButton>
    </section>
  );
}

function SuccessState({ ensName }: { ensName?: string }) {
  const ensUrl = `https://app.ens.domains/${ensName}`;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`I just secured my unique Reserve name ${ensName} on @Superfluid_HQ. Claim yours now:`)}&url=${encodeURIComponent("https://claim.superfluid.org")}`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(`I just secured my unique Reserve name ${ensName} on @superfluid. Claim yours now:\nhttps://claim.superfluid.org`)}`;
  return (
    <section aria-label="Claimed Reserve name">
      <p className="positive">Reserve name claimed</p>
      <p>{ensName}</p>
      <p>
        <Link href={ensUrl} target="_blank">[ view on ENS ]</Link>{" "}
        <Link href={xUrl} target="_blank">[ share on X ]</Link>{" "}
        <Link href={farcasterUrl} target="_blank">[ share on Farcaster ]</Link>
      </p>
    </section>
  );
}
