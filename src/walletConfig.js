import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  walletConnectWallet
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

const appName = "Financial Calligraphy";
const chains = [mainnet];

export const WALLETCONNECT_PROJECT_ID = "34a2219573c4297244a87479ab474823";

const connectors = connectorsForWallets([
  {
    groupName: "Wallets",
    wallets: [
      walletConnectWallet,
      injectedWallet
    ]
  }
], {
  appName,
  projectId: WALLETCONNECT_PROJECT_ID
});

export const walletConfig = createConfig({
  chains,
  connectors,
  transports: {
    [mainnet.id]: http()
  },
  ssr: false
});

export const walletAppInfo = {
  appName,
  projectId: WALLETCONNECT_PROJECT_ID,
};
