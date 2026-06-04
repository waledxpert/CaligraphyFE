import React, { createContext } from "react";
import { ethers } from "ethers";
import { APP_CONFIG, MintState } from "../config";
import { decodeTokenUri } from "../lib/metadata";
import { fetchRecentOwnedTokenIds, getWalletClient, hasWallet, parseMintedTokenIds } from "../lib/web3";
import { financialCalligraphyAbi } from "../contractAbi";

const MintContext = createContext(null);
const CONTRACT_INTERFACE = new ethers.Interface(financialCalligraphyAbi);
const CONTRACT_MAX_SUPPLY = 10000n;

export const MintConsumer = MintContext.Consumer;

export class MintProvider extends React.Component {
  state = {
    client: null,
    chainId: null,
    mintState: MintState.None,
    attemptCount: 0,
    commitFee: 0n,
    mintPrice: 0n,
    walletBalance: 0n,
    walletMinted: 0n,
    totalMinted: 0n,
    maxSupply: 0n,
    diceResult: null,
    roll: null,
    phase: "idle",
    txHash: "",
    tokenIds: [],
    tokens: [],
    error: ""
  };

  componentDidUpdate(prevProps) {
    const previous = prevProps.walletAdapter || {};
    const current = this.props.walletAdapter || {};
    const connectedWalletChanged =
      current.isConnected &&
      current.walletClient &&
      (
        previous.address !== current.address ||
        previous.chainId !== current.chainId ||
        previous.walletClient !== current.walletClient
      );

    if (connectedWalletChanged) {
      this.connect();
    }

    if (previous.isConnected && !current.isConnected && this.state.client) {
      this.resetWalletState();
    }
  }

  get contractReady() {
    return ethers.isAddress(APP_CONFIG.contractAddress);
  }

  get isWrongChain() {
    return Boolean(this.state.chainId && this.state.chainId !== APP_CONFIG.chainId);
  }

  get isBusy() {
    return ["committing", "rolling", "minting", "loading"].includes(this.state.phase);
  }

  get primaryState() {
    const { client, mintState, phase } = this.state;

    if (!this.contractReady) return "unconfigured";
    if (!client) return "disconnected";
    if (this.isWrongChain) return "wrongChain";
    if (phase === "committing") return "committing";
    if (phase === "rolling") return "rolling";
    if (phase === "minting") return "minting";
    if (mintState === MintState.Committed) return "committed";
    if (mintState === MintState.Minted) return "minted";
    return "ready";
  }

  connect = async () => {
    this.setState({ error: "" });
    if (!this.contractReady) return;

    try {
      const walletAdapter = this.props.walletAdapter || {};
      if (walletAdapter.openConnectModal && !walletAdapter.walletClient) {
        walletAdapter.openConnectModal();
        return;
      }

      const client = await getWalletClient(walletAdapter.walletClient);
      this.setState({ client, chainId: client.chainId }, () => this.refresh(client));
    } catch (error) {
      this.setState({ error: readableError(error) });
    }
  };

  disconnect = () => {
    this.props.walletAdapter?.disconnect?.();
    this.resetWalletState();
  };

  resetWalletState = () => {
    this.setState({
      client: null,
      chainId: null,
      mintState: MintState.None,
      attemptCount: 0,
      commitFee: 0n,
      mintPrice: 0n,
      walletBalance: 0n,
      walletMinted: 0n,
      totalMinted: 0n,
      maxSupply: 0n,
      diceResult: null,
      roll: null,
      phase: "idle",
      txHash: "",
      tokenIds: [],
      tokens: [],
      error: ""
    });
  };

  refresh = async (activeClient = this.state.client) => {
    if (!activeClient || !this.contractReady) return;

    if (this.state.phase === "idle") this.setState({ phase: "loading" });
    this.setState({ error: "" });

    try {
      const [mintState, attemptCount, commitFee, mintPrice, totalMinted, maxSupply, walletBalance, walletMinted] = await Promise.all([
        activeClient.contract.mintState(activeClient.address),
        activeClient.contract.attemptCount(activeClient.address),
        activeClient.contract.commitFee(),
        activeClient.contract.mintPrice(),
        activeClient.contract.totalMinted(),
        activeClient.contract.MAX_SUPPLY().catch(() => CONTRACT_MAX_SUPPLY),
        activeClient.provider.getBalance(activeClient.address),
        activeClient.contract.balanceOf(activeClient.address)
      ]);

      const nextState = {
        mintState: Number(mintState),
        attemptCount: Number(attemptCount),
        commitFee,
        mintPrice,
        maxSupply,
        walletBalance,
        walletMinted: Number(walletMinted),
        totalMinted
      };

      this.setState(nextState);

      if (Number(walletMinted) > 0 || Number(mintState) === MintState.Minted) {
        this.loadOwnedTokens(activeClient, totalMinted);
      } else {
        this.setState({ tokenIds: [], tokens: [] });
      }
    } catch (error) {
      this.setState({ error: readableError(error) });
    } finally {
      if (this.state.phase === "loading") this.setState({ phase: "idle" });
    }
  };

  loadOwnedTokens = async (activeClient = this.state.client, totalMinted = this.state.totalMinted) => {
    if (!activeClient) return;

    try {
      const tokenIds = await fetchRecentOwnedTokenIds(
        activeClient.provider,
        activeClient.contract,
        activeClient.address,
        totalMinted
      );
      this.setState({ tokenIds }, this.loadTokenMetadata);
    } catch (error) {
      this.setState({ tokenIds: [], tokens: [], error: readableError(error) });
    }
  };

  switchNetwork = async () => {
    try {
      if (this.props.walletAdapter?.switchChain) {
        await this.props.walletAdapter.switchChain(APP_CONFIG.chainId);
      } else {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${APP_CONFIG.chainId.toString(16)}` }]
        });
      }
      await this.connect();
    } catch (error) {
      this.setState({ error: readableError(error) });
    }
  };

  commit = async () => {
    const { client, commitFee, walletBalance } = this.state;
    this.setState({ phase: "committing", error: "", txHash: "" });

    try {
      if (walletBalance < commitFee) {
        throw new Error(
          `Insufficient ETH. Commit needs ${ethers.formatEther(commitFee)} ETH plus gas, wallet has ${ethers.formatEther(walletBalance)} ETH.`
        );
      }

      const tx = await client.contract.commitToMint({ value: commitFee });
      this.setState({ txHash: tx.hash });
      await tx.wait();
      await this.refresh();
    } catch (error) {
      this.setState({ error: readableError(error) });
    } finally {
      this.setState({ phase: "idle" });
    }
  };

  rollAndMint = async () => {
    const { client } = this.state;
    this.setState({
      phase: "rolling",
      error: "",
      txHash: "",
      roll: null,
      diceResult: null
    });

    try {
      const response = await fetch(`${APP_CONFIG.backendUrl}/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: client.address })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 429) {
          throw new Error(body?.error || "ROLL_RATE_LIMITED");
        }
        throw new Error(body?.error || `Backend roll failed (${response.status})`);
      }

      const roll = await response.json();
      this.setState({ roll, diceResult: Number(roll.diceResult) });
      await delay(1200);
      await this.mint(roll);
    } catch (error) {
      this.setState({ error: readableError(error), phase: "idle" });
    }
  };

  mint = async (roll) => {
    const { client, mintPrice, txHash, walletBalance } = this.state;
    this.setState({ phase: "minting" });

    try {
      const mintPayment = mintPrice;
      if (walletBalance < mintPayment) {
        throw new Error(
          `Insufficient ETH. Mint needs ${ethers.formatEther(mintPayment)} ETH plus gas, wallet has ${ethers.formatEther(walletBalance)} ETH.`
        );
      }

      const tx = await client.contract.mintWithDice(roll.diceResult, roll.nonce, roll.signature, {
        value: mintPayment
      });
      this.setState({ txHash: tx.hash });
      await patchRoll(roll.nonce, "submitted", tx.hash);

      const receipt = await tx.wait();
      const tokenIds = parseMintedTokenIds(receipt, client.contract);
      this.setState({ tokenIds }, this.loadTokenMetadata);
      await patchRoll(roll.nonce, "minted", tx.hash);
      await this.refresh();
    } catch (error) {
      await patchRoll(roll.nonce, "failed", txHash);
      this.setState({ error: readableError(error) });
    } finally {
      this.setState({ phase: "idle" });
    }
  };

  loadTokenMetadata = async () => {
    const { client, tokenIds } = this.state;
    if (!client || tokenIds.length === 0) {
      this.setState({ tokens: [] });
      return;
    }

    try {
      const tokens = await Promise.all(
        tokenIds.map(async (id) => {
          const uri = await client.contract.tokenURI(id);
          return { id, ...decodeTokenUri(uri) };
        })
      );
      this.setState({ tokens });
    } catch (error) {
      this.setState({ error: readableError(error) });
    }
  };

  handlePrimaryAction = async () => {
    if (this.primaryState === "unconfigured") return;
    if (this.primaryState === "disconnected") return this.connect();
    if (this.primaryState === "wrongChain") return this.switchNetwork();
    if (this.primaryState === "committed") return this.rollAndMint();
    if (this.primaryState === "minted") {
      this.setState({ error: "This wallet has already minted." });
      return this.refresh();
    }
    if (this.primaryState === "ready") return this.commit();
  };

  render() {
    return (
      <MintContext.Provider
        value={{
          ...this.state,
          contractReady: this.contractReady,
          isWrongChain: this.isWrongChain,
          isBusy: this.isBusy,
          primaryState: this.primaryState,
          hasWallet: hasWallet() || Boolean(this.props.walletAdapter?.openConnectModal),
          connect: this.connect,
          disconnect: this.disconnect,
          switchNetwork: this.switchNetwork,
          handlePrimaryAction: this.handlePrimaryAction
        }}
      >
        {this.props.children}
      </MintContext.Provider>
    );
  }
}

async function patchRoll(nonce, status, txHash) {
  if (!nonce) return;

  await fetch(`${APP_CONFIG.backendUrl}/rolls/${nonce}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, txHash })
  }).catch(() => {});
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readableError(error) {
  const contractError = contractErrorName(error);
  if (contractError && CONTRACT_ERROR_COPY[contractError]) {
    return CONTRACT_ERROR_COPY[contractError];
  }

  const message =
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    "Something went wrong";

  return normalizeOperationalError(message.replace(/^execution reverted: /i, ""));
}

function normalizeOperationalError(message) {
  const lower = message.toLowerCase();
  if (
    message === "ROLL_RATE_LIMITED" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("429")
  ) {
    return "Too many roll requests. Please wait a minute and try again.";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    lower.includes("request_timeout")
  ) {
    return "The roll request timed out. Please try again.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "Could not reach the roll server. Please check your connection and try again.";
  }
  return message;
}

function contractErrorName(error) {
  if (!error) return "";
  if (error.errorName) return error.errorName;
  if (error.revert?.name) return error.revert.name;

  const text = [
    error.shortMessage,
    error.reason,
    error.message,
    error.info?.error?.message,
    error.error?.message
  ]
    .filter(Boolean)
    .join(" ");

  for (const name of Object.keys(CONTRACT_ERROR_COPY)) {
    if (text.includes(name)) return name;
  }

  const data = error.data || error.info?.error?.data || error.error?.data;
  if (typeof data === "string") {
    try {
      return CONTRACT_INTERFACE.parseError(data)?.name || "";
    } catch {
      return "";
    }
  }

  return "";
}

const CONTRACT_ERROR_COPY = {
  AlreadyMinted: "This wallet has already minted.",
  BadCommitFee: "The commit fee changed. Refresh and try again.",
  BadDiceResult: "The dice result is invalid. Please roll again.",
  BadMintPayment: "The mint payment does not match the fixed mint price. Refresh and try again.",
  BadSignature: "The roll signature could not be verified. Please roll again.",
  InvalidTransferValidatorContract: "The transfer validator address is invalid.",
  MaxAttemptsReached: "This wallet has used all commit attempts.",
  MessageUsed: "This signed roll has already been used.",
  NonceUsed: "This roll nonce has already been used.",
  NotCommitted: "Commit first before rolling and minting.",
  SoldOut: "The collection is sold out.",
  ZeroAddress: "A required wallet address is missing."
};
