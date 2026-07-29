"use client";

import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";

import {
  SWAP_CAMPAIGN_CHAIN_ID,
  SWAP_CAMPAIGN_TOKENS,
  SWAP_REFERRER_ADDRESS,
  SWAP_REFERRER_SESSION_KEY,
} from "../../config/swap";
import { useFarcasterFrame } from "../../contexts/FarcasterFrameProvider";
import { useWalletDialog } from "../../contexts/WalletDialogContext";
import { APP_CHAIN } from "../../config/chains";
import { useWalletAccount } from "../../hooks/useWalletAccount";
import { formatTokenAmount, SUP_SYMBOL } from "../../lib/format";

function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : (fallback ?? null);
}

function useSwapReferrer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [referrer, setReferrer] = useState<string | null>(null);
  useEffect(() => {
    const parameter = searchParams.get("r");
    if (parameter) {
      const normalized = parameter.toLowerCase();
      sessionStorage.setItem(SWAP_REFERRER_SESSION_KEY, normalized);
      setReferrer(normalized);
      router.replace(pathname, { scroll: false });
      return;
    }
    const stored = sessionStorage.getItem(SWAP_REFERRER_SESSION_KEY);
    if (stored) setReferrer(stored);
  }, [pathname, router, searchParams]);
  return referrer;
}

function SupportedTokensList() {
  const { address } = useWalletAccount();
  const usdcx = useReadContract({
    abi: erc20Abi,
    address: SWAP_CAMPAIGN_TOKENS[0].superTokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(address) },
  });
  const usdsx = useReadContract({
    abi: erc20Abi,
    address: SWAP_CAMPAIGN_TOKENS[1].superTokenAddress,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: APP_CHAIN.id,
    query: { enabled: Boolean(address) },
  });
  const balances = [usdcx.data, usdsx.data];
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-subtitle2">Your Super Token Balances:</h3>
      <div className="flex flex-col gap-3">
        {SWAP_CAMPAIGN_TOKENS.map((token, index) => (
          <div
            key={token.superTokenAddress}
            className="flex items-center gap-3"
          >
            <img src={token.iconUrl} alt={token.symbol} className="h-5 w-5" />
            <span className="w-16">{token.symbol}</span>
            {address && (
              <strong>
                {balances[index] ? formatTokenAmount(balances[index], 2) : "0"}
              </strong>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ListItem({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-green-sf text-xs text-green-sf">
        {index}
      </span>
      <p>{children}</p>
    </div>
  );
}

export default function SwapPage() {
  const { isInMiniApp } = useFarcasterFrame();
  const { open } = useWalletDialog();
  const referrerKey = useSwapReferrer();
  const config = useMemo(() => {
    const targetAddresses = new Set(
      SWAP_CAMPAIGN_TOKENS.flatMap((token) => [
        token.superTokenAddress.toLowerCase(),
        token.underlyingTokenAddress.toLowerCase(),
      ]),
    );
    return {
      integrator: "superfluid-claim-app",
      appearance: "light",
      theme: {
        container: { borderRadius: "12px" },
        palette: { primary: { main: "#75EB00" } },
        components: {
          MuiButtonBase: { defaultProps: { disableRipple: true } },
          MuiButton: {
            styleOverrides: {
              root: { "&:hover": { backgroundColor: "#75EB00" } },
            },
          },
        },
      },
      fromChain: SWAP_CAMPAIGN_CHAIN_ID,
      toChain: SWAP_CAMPAIGN_CHAIN_ID,
      toToken: SWAP_CAMPAIGN_TOKENS[0].superTokenAddress,
      ...(referrerKey &&
      SWAP_REFERRER_ADDRESS[referrerKey as keyof typeof SWAP_REFERRER_ADDRESS]
        ? {
            referrer:
              SWAP_REFERRER_ADDRESS[
                referrerKey as keyof typeof SWAP_REFERRER_ADDRESS
              ],
          }
        : {}),
      chains: {
        from: { allow: [SWAP_CAMPAIGN_CHAIN_ID] },
        to: { allow: [SWAP_CAMPAIGN_CHAIN_ID] },
      },
      tokens: {
        to: {
          allow: SWAP_CAMPAIGN_TOKENS.map((token) => ({
            chainId: SWAP_CAMPAIGN_CHAIN_ID,
            address: token.superTokenAddress,
          })),
        },
      },
      exchanges: { deny: ["fly"] },
      feeConfig: {
        calculateFee: async ({
          fromToken,
        }: {
          fromToken?: { address?: string };
        }) =>
          0.01 *
          Number(!targetAddresses.has(fromToken?.address?.toLowerCase() ?? "")),
      },
      sdkConfig: {
        rpcUrls: {
          [SWAP_CAMPAIGN_CHAIN_ID]: [
            "https://rpc-endpoints.superfluid.dev/base-mainnet",
          ],
        },
      },
      walletConfig: {
        usePartialWalletManagement: true,
        onConnect: () => {
          if (!isInMiniApp) open("connect");
        },
      },
      hiddenUI: [
        "walletMenu",
        "appearance",
        "toAddress",
        "reverseTokensButton",
        "chainSelect",
      ],
    };
  }, [isInMiniApp, open, referrerKey]);

  return (
    <main className="relative overflow-hidden rounded-lg bg-[radial-gradient(circle_at_center,#8AE5C3_0%,#0A6643_100%)] p-5 md:p-16">
      <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-[1.25fr_1fr]">
        <section className="order-2 rounded-xl bg-[#0a1f0a] bg-[url('/dots5.svg')] bg-bottom bg-no-repeat p-5 text-gray-100 md:order-1 md:px-9">
          <p className="uppercase text-alto">Super Token Campaign</p>
          <h1 className="text-h1 text-green-sf">Swap Tokens</h1>
          <p>
            Swap your tokens into Super Token stablecoins on Base mainnet and
            start earning points. Hold USDCx or USDSx to accumulate rewards that
            convert into SUP.
          </p>
          <p>
            To be eligible for rewards, you must hold at least{" "}
            <strong>
              10{" "}
              <img
                src={SWAP_CAMPAIGN_TOKENS[0].iconUrl}
                alt="USDCx"
                className="inline h-4 w-4"
              />{" "}
              USDCx
            </strong>{" "}
            or{" "}
            <strong>
              10{" "}
              <img
                src={SWAP_CAMPAIGN_TOKENS[1].iconUrl}
                alt="USDSx"
                className="inline h-4 w-4"
              />{" "}
              USDSx
            </strong>{" "}
            on Base mainnet. Points for this campaign are calculated and updated
            daily based on your Super Token balances.
          </p>
          <SupportedTokensList />
          <h2>How to Swap:</h2>
          <div className="space-y-1">
            <ListItem index={1}>Connect your wallet to get started</ListItem>
            <ListItem index={2}>
              Select USDCx or USDSx token on Base mainnet
            </ListItem>
            <ListItem index={3}>Enter the amount you want to swap</ListItem>
            <ListItem index={4}>
              Confirm the swap transaction and start earning{" "}
              <span className="badge">{SUP_SYMBOL}</span>
            </ListItem>
          </div>
        </section>
        <section className="order-1 overflow-hidden rounded-xl md:order-2">
          <ClientOnly fallback={<WidgetSkeleton config={config as never} />}>
            <LiFiWidget
              config={config as never}
              integrator="superfluid-claim-app"
            />
          </ClientOnly>
        </section>
      </div>
    </main>
  );
}
