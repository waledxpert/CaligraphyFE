export const APP_CONFIG = {
  backendUrl: import.meta.env.VITE_BACKEND_URL || "http://localhost:3001",
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || "",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 31337),
  chainName: import.meta.env.VITE_CHAIN_NAME || "Sepolia",
  explorerTxUrl: import.meta.env.VITE_EXPLORER_TX_URL || "",
  marketplaceUrl: import.meta.env.VITE_MARKETPLACE_URL || "",
  maxSupply: Number(import.meta.env.VITE_MAX_SUPPLY || 0)
};

export const MintState = {
  None: 0,
  Committed: 1,
  Minted: 2
};

export function stateLabel(state) {
  if (state === MintState.Committed) return "Committed";
  if (state === MintState.Minted) return "Minted";
  return "Ready";
}
