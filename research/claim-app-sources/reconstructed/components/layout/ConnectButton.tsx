"use client";

import { useAppKit } from "@reown/appkit/react";

import { useFarcasterFrame } from "../../contexts/FarcasterFrameProvider";
import { useAddressProfile } from "../../hooks/useAddressProfile";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { LoadingText } from "./LoadingText";

export function ConnectButton() {
  const { isInMiniApp, isMiniAppLoading } = useFarcasterFrame();
  const { address, isConnected, isConnecting, isReconnecting } =
    useWalletAccount();
  const { open } = useAppKit();
  const profile = useAddressProfile(address);
  if (isMiniAppLoading || isConnecting || isReconnecting)
    return (
      <button className="min-w-[100px]" disabled>
        <LoadingText loading>Connecting</LoadingText>
      </button>
    );
  if (isConnected && address) {
    const label =
      profile?.primaryName || profile?.addressTruncated || "Connected";
    return (
      <button
        className="min-w-[100px]"
        data-testid="connected-address-button"
        onClick={isInMiniApp ? undefined : () => open({ view: "Account" })}
      >
        {label}
      </button>
    );
  }
  if (isInMiniApp)
    return (
      <button className="min-w-[100px]" disabled>
        Connect Wallet
      </button>
    );
  return (
    <button
      className="min-w-[100px]"
      data-testid="connect-wallet-button"
      onClick={() => open({ view: "Connect" })}
    >
      Connect Wallet
    </button>
  );
}
