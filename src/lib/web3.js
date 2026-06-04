import { ethers } from "ethers";
import { APP_CONFIG } from "../config";
import { financialCalligraphyAbi } from "../contractAbi";

export function hasWallet() {
  return Boolean(window.ethereum);
}

export async function getWalletClient(walletClient) {
  if (walletClient) {
    return getWalletClientFromViem(walletClient);
  }

  if (!hasWallet()) {
    throw new Error("No injected wallet found. Install MetaMask or another EVM wallet.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const contract = new ethers.Contract(APP_CONFIG.contractAddress, financialCalligraphyAbi, signer);

  return {
    provider,
    signer,
    contract,
    address: await signer.getAddress(),
    chainId: Number(network.chainId)
  };
}

async function getWalletClientFromViem(walletClient) {
  const provider = new ethers.BrowserProvider(walletClient.transport, walletClient.chain?.id);
  const signer = await provider.getSigner(walletClient.account.address);
  const network = await provider.getNetwork();
  const contract = new ethers.Contract(APP_CONFIG.contractAddress, financialCalligraphyAbi, signer);

  return {
    provider,
    signer,
    contract,
    address: await signer.getAddress(),
    chainId: Number(network.chainId)
  };
}

export function parseMintedTokenIds(receipt, contract) {
  const zero = ethers.ZeroAddress.toLowerCase();
  const ids = [];

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "Transfer" &&
        parsed.args.from.toLowerCase() === zero &&
        parsed.args.to
      ) {
        ids.push(parsed.args.tokenId.toString());
      }
    } catch {
      // Ignore logs emitted by other contracts in the same transaction.
    }
  }

  return ids;
}

export async function fetchRecentOwnedTokenIds(provider, contract, owner, totalMinted = 0n) {
  try {
    return await fetchOwnedTokenIdsFromLogs(provider, contract, owner);
  } catch {
    return fetchOwnedTokenIdsByOwnerScan(contract, owner, totalMinted);
  }
}

async function fetchOwnedTokenIdsFromLogs(provider, contract, owner) {
  const [incoming, outgoing] = await Promise.all([
    provider.getLogs({
      ...contract.filters.Transfer(null, owner),
      fromBlock: 0,
      toBlock: "latest"
    }),
    provider.getLogs({
      ...contract.filters.Transfer(owner, null),
      fromBlock: 0,
      toBlock: "latest"
    })
  ]);
  const owned = new Set();

  [...incoming, ...outgoing]
    .sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)
    .forEach((log) => {
      const parsed = contract.interface.parseLog(log);
      const tokenId = parsed.args.tokenId.toString();
      if (parsed.args.to.toLowerCase() === owner.toLowerCase()) owned.add(tokenId);
      if (parsed.args.from.toLowerCase() === owner.toLowerCase()) owned.delete(tokenId);
    });

  return [...owned];
}

async function fetchOwnedTokenIdsByOwnerScan(contract, owner, totalMinted) {
  const maxTokenId = Number(totalMinted || 0n);
  if (!maxTokenId) return [];

  const newestWindowStart = Math.max(1, maxTokenId - 250);
  const newestOwned = await scanOwnerRange(contract, owner, newestWindowStart, maxTokenId);
  if (newestOwned.length > 0) return newestOwned;

  // Last resort for older mints. The contract caps at 10k, but keep this bounded
  // to avoid surprise RPC floods if a provider cannot serve historical logs.
  if (maxTokenId > 1000) return [];
  return scanOwnerRange(contract, owner, 1, maxTokenId);
}

async function scanOwnerRange(contract, owner, startTokenId, endTokenId) {
  const owned = [];
  const batchSize = 40;
  for (let start = startTokenId; start <= endTokenId; start += batchSize) {
    const end = Math.min(start + batchSize - 1, endTokenId);
    const batch = [];
    for (let tokenId = start; tokenId <= end; tokenId++) {
      batch.push(
        contract.ownerOf(tokenId)
          .then((tokenOwner) => tokenOwner.toLowerCase() === owner.toLowerCase() ? String(tokenId) : null)
          .catch(() => null)
      );
    }
    const results = await Promise.all(batch);
    results.forEach((tokenId) => {
      if (tokenId) owned.push(tokenId);
    });
  }

  return owned;
}
