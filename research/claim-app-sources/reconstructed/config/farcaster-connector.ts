import { sdk } from "@farcaster/frame-sdk";
import {
  ChainNotConfiguredError,
  createConnector,
  ProviderNotFoundError,
} from "wagmi";
import { fromHex, getAddress, numberToHex, SwitchChainError } from "viem";

type FarcasterProvider = NonNullable<
  Awaited<ReturnType<typeof sdk.wallet.getEthereumProvider>>
>;

/** Connect Wagmi directly to the EIP-1193 provider exposed by the mini-app host. */
export function farcasterMiniApp() {
  let provider: FarcasterProvider | undefined;

  return createConnector<FarcasterProvider>((config) => ({
    id: "farcaster",
    name: "Farcaster",
    type: "farcasterMiniApp",
    async connect({ chainId } = {}) {
      const farcasterProvider = await this.getProvider();
      const accounts = await farcasterProvider.request({
        method: "eth_requestAccounts",
      });

      let currentChainId = await this.getChainId();
      if (chainId && currentChainId !== chainId) {
        currentChainId = (await this.switchChain!({ chainId })).id;
      }

      return {
        accounts: accounts.map((account) => getAddress(account)),
        chainId: currentChainId,
      };
    },
    async disconnect() {
      // The host owns the wallet session; detaching Wagmi must not revoke it.
    },
    async getAccounts() {
      const accounts = await (await this.getProvider()).request({
        method: "eth_accounts",
      });
      return accounts.map((account) => getAddress(account));
    },
    async getChainId() {
      const chainId = await (await this.getProvider()).request({
        method: "eth_chainId",
      });
      return fromHex(chainId, "number");
    },
    async getProvider() {
      provider ??= await sdk.wallet.getEthereumProvider();
      if (!provider) throw new ProviderNotFoundError();
      return provider;
    },
    async isAuthorized() {
      try {
        return (await this.getAccounts()).length > 0;
      } catch {
        return false;
      }
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((candidate) => candidate.id === chainId);
      if (!chain) {
        throw new SwitchChainError(new ChainNotConfiguredError());
      }
      await (await this.getProvider()).request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(chainId) }],
      });
      return chain;
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) this.onDisconnect();
      else {
        config.emitter.emit("change", {
          accounts: accounts.map((account) => getAddress(account)),
        });
      }
    },
    onChainChanged(chainId) {
      config.emitter.emit("change", { chainId: Number(chainId) });
    },
    onDisconnect() {
      config.emitter.emit("disconnect");
    },
  }));
}
