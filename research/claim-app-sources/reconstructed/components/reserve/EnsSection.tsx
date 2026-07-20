"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBalance } from "wagmi";

import { useExpectedChains } from "../../contexts/ExpectedChainContext";
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
    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-platinum p-9">
      <span className="text-[38px]">
        <LoadingText loading>Loading</LoadingText>
      </span>
      <img
        src="/coin-spin.png"
        alt="Spinning coin"
        className="h-[336px] w-[336px]"
      />
    </div>
  );
}

function ConnectWalletState() {
  return (
    <div className="flex h-full flex-col items-center justify-between rounded-xl bg-platinum p-9">
      <div />
      <div className="text-center">
        <h2 className="text-h7">Connect to claim your Reserve name</h2>
        <img src="/fluid-bg-1.png" alt="Fluid cover" />
      </div>
      <SignUpToParticipateButton buttonText="Connect Wallet" />
    </div>
  );
}

function CreateReserveState() {
  return (
    <div className="flex min-h-[592px] flex-col items-center justify-between rounded-xl bg-[#E9E9E9] bg-[url('/reserve-bg.png')] bg-bottom bg-cover p-9 text-center">
      <div />
      <div className="max-w-[420px]">
        <h2 className="text-h7">Create Your Reserve First</h2>
        <p>
          You need to create your reserve before you can claim an ENS name for
          your Reserve.
        </p>
        <p>
          Your reserve is where all your SUP rewards are collected and managed.
        </p>
      </div>
      <Link className="button" href="/claim">
        Go to create your reserve
      </Link>
    </div>
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
  const { airdropChain } = useExpectedChains();
  const validation = validateReserveSubdomain(subdomain);
  const availabilityLoading =
    debouncedSubdomain !== subdomain ||
    (validation.isValid && registration.readSubdomainAvailability.isFetching);
  const fee = getReserveNameFee(subdomain);
  const balance = useBalance({
    address: accountAddress,
    chainId: airdropChain.id,
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

  useEffect(() => {
    if (success)
      void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }, [success]);
  if (success)
    return (
      <SuccessState
        ensName={`${subdomain}.reserve.superfluid.eth`}
        showConfetti
      />
    );

  const feeLabel = subdomain ? `${Number(fee) / 1e18} ETH` : "";
  let buttonLabel = "Claim Name";
  if (!validation.isValid && subdomain) buttonLabel = "Invalid Input";
  else if (validation.isValid && !hasSufficientEth)
    buttonLabel = "Insufficient ETH";
  else if (registration.status?.isLoading)
    buttonLabel = registration.status.displayText;
  else if (
    validation.isValid &&
    registration.isAvailable &&
    debouncedSubdomain === subdomain &&
    !availabilityLoading
  )
    buttonLabel = `Claim for ${feeLabel}`;
  else if (
    validation.isValid &&
    !registration.isAvailable &&
    debouncedSubdomain === subdomain &&
    !availabilityLoading
  )
    buttonLabel = "Not Available";

  return (
    <div className="flex h-full flex-col items-center justify-between rounded-xl bg-[#E9E9E9] bg-[url('/claim-success.png')] bg-bottom bg-no-repeat p-6 text-center">
      <div className="max-w-[463px] flex-1">
        <h2 className="mt-8 text-h7">Claim a name for your Reserve</h2>
        <p className="uppercase">
          Type in your desired name and check if it&apos;s available. Each user
          can only claim one Reserve name, so choose wisely.
        </p>
        <label className="mt-8 block text-green text-sm uppercase">
          Your Reserve Name
        </label>
        <div className="relative mt-2">
          <input
            type="text"
            placeholder="mynamehere"
            value={subdomain}
            onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
            className="h-14 w-full border-green bg-[#E9E9E9] text-center text-h7"
          />
          <span className="text-green text-xs uppercase">
            {subdomain || "mynamehere"}.reserve.superfluid.eth
          </span>
          {availabilityLoading && validation.isValid && (
            <span aria-label="Checking availability">…</span>
          )}
        </div>
        <p className="mt-12 uppercase">
          Pay a one-time ETH fee based on name length. Once claimed, the Reserve
          name is yours forever - no renewals required.
        </p>
      </div>
      <TransactionButton
        dataTestId="register-ens-name-button"
        chain={airdropChain}
        onClick={registration.register}
        status={registration.status}
        ButtonProps={{ disabled: !canRegister }}
      >
        {buttonLabel}
      </TransactionButton>
    </div>
  );
}

function SuccessState({
  ensName,
  showConfetti = false,
}: {
  ensName?: string;
  showConfetti?: boolean;
}) {
  useEffect(() => {
    if (showConfetti)
      void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }, [showConfetti]);
  const label = ensName?.split(".")[0];
  const ensUrl = `https://app.ens.domains/${ensName}`;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`I just secured my unique Reserve name ${ensName} on @Superfluid_HQ! 🚀 Claim yours now:`)}&url=${encodeURIComponent("https://claim.superfluid.org")}`;
  const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(`I just secured my unique Reserve name ${ensName} on @superfluid! 🚀 Claim yours now:\nhttps://claim.superfluid.org`)}`;
  return (
    <div className="flex min-h-[592px] flex-col items-center justify-between rounded-xl bg-[#E9E9E9] p-9 text-center">
      <div>
        <h2 className="text-h7">Name claimed!</h2>
        <p className="uppercase">
          Your reserve now has a unique ENS name. Go share it with others!
        </p>
        <p className="mt-6 text-green text-sm uppercase">
          Your Claimed Reserve Name
        </p>
        <div className="h-14 rounded-md border-2 border-green text-h7">
          {label}
        </div>
        <p className="mt-8 text-green text-xs uppercase">
          Full ENS Name
          <br />
          {ensName}
        </p>
      </div>
      <div className="w-full space-y-3">
        <Link className="button" href={ensUrl} target="_blank">
          View on ENS
        </Link>
        <Link className="button" href={xUrl} target="_blank">
          Share on X
        </Link>
        <Link className="button" href={farcasterUrl} target="_blank">
          Share on Farcaster
        </Link>
      </div>
    </div>
  );
}
