"use client";

import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { erc20Abi } from "viem";
import { useReadContract } from "wagmi";

import { APP_CHAIN } from "../../config/chains";
import {
  SWAP_CAMPAIGN_CHAIN_ID,
  SWAP_CAMPAIGN_TOKENS,
  SWAP_REFERRER_ADDRESS,
  SWAP_REFERRER_SESSION_KEY,
} from "../../config/swap";
import { useFarcasterFrame } from "../../contexts/FarcasterFrameProvider";
import { useWalletDialog } from "../../contexts/WalletDialogContext";
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
    <div className="route-lines">
      {SWAP_CAMPAIGN_TOKENS.map((token, index) => (
        <p className="route-line" key={token.superTokenAddress}>
          <strong>{token.symbol}</strong>
          <span>
            {address
              ? formatTokenAmount(balances[index] ?? 0n, 2)
              : "connect wallet to read balance"}
          </span>
        </p>
      ))}
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
      appearance: "dark",
      theme: {
        container: {
          borderRadius: "0px",
          boxShadow: "none",
        },
        shape: { borderRadius: 0 },
        typography: {
          fontFamily:
            'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
          fontSize: 16,
        },
        palette: {
          mode: "dark",
          primary: { main: "#69ff50", contrastText: "#000000" },
          background: { default: "#000000", paper: "#000000" },
          text: { primary: "#f4f4f4", secondary: "#858585" },
          divider: "#858585",
        },
        components: {
          MuiButtonBase: { defaultProps: { disableRipple: true } },
          MuiPaper: {
            styleOverrides: {
              root: { backgroundImage: "none", boxShadow: "none" },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 0,
                boxShadow: "none",
                textTransform: "none",
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: { root: { borderRadius: 0 } },
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
    <main className="terminal-page">
      <p className="command-line">
        <span className="prompt">&gt;</span> swap
      </p>
      <p>
        swap supported Base assets into USDCx or USDSx and accumulate campaign
        points
      </p>
      <p>
        eligibility starts at 10 USDCx or 10 USDSx; campaign balances are
        calculated daily and convert into {SUP_SYMBOL}
      </p>

      <SupportedTokensList />

      <p className="dim">
        swap execution is provided by LI.FI inside the terminal client boundary
      </p>
      <section aria-label="Swap interface">
        <ClientOnly fallback={<WidgetSkeleton config={config as never} />}>
          <LiFiWidget
            config={config as never}
            integrator="superfluid-claim-app"
          />
        </ClientOnly>
      </section>
    </main>
  );
}
