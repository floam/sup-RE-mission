"use client";

import { useFarcasterFrame } from "../../contexts/FarcasterFrameProvider";
import { useWalletDialog } from "../../contexts/WalletDialogContext";
import { useAddressProfile } from "../../hooks/useAddressProfile";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { LoadingText } from "./LoadingText";

export function ConnectButton() {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const { address, isConnected, isConnecting, isReconnecting } =
    useWalletAccount();
  const { open } = useWalletDialog();
  const profile = useAddressProfile(address);

  if (isMiniAppLoading || isConnecting || isReconnecting)
    return (
      <button disabled>
        [ <LoadingText loading>connecting</LoadingText> ]
      </button>
    );

  if (isConnected && address) {
    const label =
      profile?.primaryName || profile?.addressTruncated || "connected";
    return (
      <button
        data-testid="connected-address-button"
        onClick={isInMiniApp ? undefined : () => open("account")}
      >
        [ {label} ]
      </button>
    );
  }

  if (isInMiniApp)
    return <button disabled>[ connect wallet ]</button>;

  return (
    <button
      data-testid="connect-wallet-button"
      onClick={() => open("connect")}
    >
      [ connect wallet ]
    </button>
  );
}
