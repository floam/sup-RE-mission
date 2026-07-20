"use client";

import { useAppKit, useAppKitState } from "@reown/appkit/react";
import { useEffect, useState } from "react";

import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";
import { useWalletAccount } from "../hooks/useWalletAccount";

export function SignUpToParticipateButton({
  buttonText = "Sign Up to Participate",
}) {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  if (isMiniAppLoading) return <button className="invisible">.</button>;
  return isInMiniApp ? (
    <FrameSignUpButton buttonText={buttonText} />
  ) : (
    <AppKitSignUpButton buttonText={buttonText} />
  );
}

function FrameSignUpButton({ buttonText }: { buttonText: string }) {
  const { isConnected } = useWalletAccount();
  return isConnected ? null : <button disabled>{buttonText}</button>;
}

function AppKitSignUpButton({ buttonText }: { buttonText: string }) {
  const { open } = useAppKit();
  const { initialized, loading } = useAppKitState();
  const { isConnecting } = useWalletAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !initialized || loading)
    return <button className="invisible">.</button>;
  return (
    <button
      data-testid="card-connect-wallet-button"
      onClick={() => open({ view: "Connect" })}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : buttonText}
    </button>
  );
}
