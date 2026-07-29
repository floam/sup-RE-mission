"use client";

import { useFarcasterFrame } from "../contexts/FarcasterFrameProvider";
import { useWalletDialog } from "../contexts/WalletDialogContext";
import { useWalletAccount } from "../hooks/useWalletAccount";

export function SignUpToParticipateButton({
  buttonText = "Sign Up to Participate",
}) {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  if (isMiniAppLoading) return <button className="invisible">.</button>;
  return isInMiniApp ? (
    <FrameSignUpButton buttonText={buttonText} />
  ) : (
    <WalletSignUpButton buttonText={buttonText} />
  );
}

function FrameSignUpButton({ buttonText }: { buttonText: string }) {
  const { isConnected } = useWalletAccount();
  return isConnected ? null : <button disabled>{buttonText}</button>;
}

function WalletSignUpButton({ buttonText }: { buttonText: string }) {
  const { open } = useWalletDialog();
  const { isConnecting } = useWalletAccount();
  return (
    <button
      data-testid="card-connect-wallet-button"
      onClick={() => open("connect")}
      disabled={isConnecting}
    >
      {isConnecting ? "Connecting..." : buttonText}
    </button>
  );
}
