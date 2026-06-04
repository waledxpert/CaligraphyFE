import React, { Component, Suspense, lazy } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Copy,
  Coins,
  Dice5,
  ExternalLink,
  Loader2,
  LogOut,
  PlugZap,
  RefreshCcw,
  ScrollText,
  Wallet,
  X
} from "lucide-react";
import { ethers } from "ethers";
import { AnimatePresence, motion } from "motion/react";
import { APP_CONFIG, MintState, stateLabel } from "./config";
import { shortAddress } from "./lib/metadata";
import { MintConsumer, MintProvider } from "./context/MintContext";

const DiceScene = lazy(() => import("./components/DiceScene"));
const MARK = "\u8ca1\u66f8";
const CAI = "\u8ca1";
const SHU = "\u66f8";

const actionCopy = {
  disconnected: "Connect Wallet",
  unconfigured: "Add Contract Address",
  wrongChain: "Switch Network",
  committing: "Committing...",
  rolling: "Rolling...",
  minting: "Minting...",
  committed: "Roll & Mint",
  minted: "Already Minted",
  ready: "Commit"
};

export default class App extends Component {
  render() {
    return <WalletBridge />;
  }
}

function WalletBridge() {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const walletAdapter = {
    address,
    chainId,
    isConnected,
    walletClient,
    openConnectModal,
    disconnect,
    switchChain: (targetChainId) => switchChainAsync({ chainId: targetChainId })
  };

  return (
    <MintProvider walletAdapter={walletAdapter}>
      <MintConsumer>{(mint) => <AppShell mint={mint} />}</MintConsumer>
    </MintProvider>
  );
}

class AppShell extends Component {
  state = { receiveOpen: false, toast: null, walletModalOpen: false };

  componentDidUpdate(prevProps) {
    const { mint } = this.props;

    if (mint.error && mint.error !== prevProps.mint.error) {
      this.showToast("error", shapeError(mint.error));
    }
    if (mint.client && !prevProps.mint.client) {
      this.showToast("success", "Wallet connected. Ledger is ready.");
    }
    if (!mint.client && prevProps.mint.client) {
      this.showToast("info", "Wallet disconnected.");
    }
    if (mint.diceResult && mint.diceResult !== prevProps.mint.diceResult) {
      this.setState({ receiveOpen: true });
      this.showToast("success", `Dice settled on ${mint.diceResult}. Minting ${mint.diceResult} Caligraph${mint.diceResult > 1 ? "s" : ""}.`);
    }
    if (mint.mintState === MintState.Minted && prevProps.mint.mintState !== MintState.Minted) {
      this.setState({ receiveOpen: true });
      this.showToast("success", `Mint complete. Your ${MARK} Caligraphs are in the receive panel.`);
    }
  }

  showToast = (type, message) => {
    window.clearTimeout(this.toastTimer);
    this.setState({ toast: { id: Date.now(), type, message } });
    this.toastTimer = window.setTimeout(() => this.setState({ toast: null }), 5200);
  };

  closeToast = () => {
    window.clearTimeout(this.toastTimer);
    this.setState({ toast: null });
  };

  toggleReceive = () => {
    this.setState((state) => ({ receiveOpen: !state.receiveOpen }));
  };

  openWalletModal = () => {
    this.setState({ walletModalOpen: true });
  };

  closeWalletModal = () => {
    this.setState({ walletModalOpen: false });
  };

  copyAddress = async () => {
    const address = this.props.mint.client?.address;
    if (!address) return;
    await navigator.clipboard?.writeText(address);
    this.showToast("success", "Wallet address copied.");
  };

  render() {
    const { mint } = this.props;
    const { receiveOpen, toast, walletModalOpen } = this.state;
    const maxSupply = mint.maxSupply || BigInt(APP_CONFIG.maxSupply || 0);
    const supplyText = `${mint.totalMinted.toString()}/${Number(maxSupply || 10000n)}`;

    return (
      <main className="min-h-screen paper-surface text-ink lg:max-h-screen lg:overflow-hidden">
        <div className="background-kanji left-[-3vw] top-[3vh]">{CAI}</div>
        <div className="background-kanji right-[-2vw] bottom-[-9vh]">{SHU}</div>
        <Toast toast={toast} onClose={this.closeToast} />

        <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 lg:h-screen lg:grid-cols-[0.9fr_1.1fr]">
          <section className="ledger-panel flex min-h-[56vh] flex-col justify-between px-5 py-4 sm:px-8 lg:h-screen lg:min-h-0 lg:overflow-y-auto">
            <nav className="flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="seal-mark">{CAI}</div>
                <div>
                  <p className="text-2xl leading-none font-display text-cinnabar">{MARK}</p>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-ink/50">Financial calligraphy</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="wallet-trigger"
                  onClick={this.openWalletModal}
                  title="Wallet"
                  type="button"
                >
                  <Wallet size={18} />
                  <span>{mint.client ? shortAddress(mint.client.address) : "Connect"}</span>
                </button>
                {mint.client ? (
                  <button className="hidden square-button sm:inline-grid" onClick={mint.disconnect} title="Disconnect wallet" type="button">
                    <LogOut size={18} />
                  </button>
                ) : null}
              </div>
            </nav>

            <div className="grid gap-5 py-7 lg:py-8">
              <div className="max-w-2xl pl-5 border-l-4 border-cinnabar">
                <p className="mb-3 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-cinnabar">
                  <span className="mini-stamp">{CAI}</span>
                  Commit-reveal mint
                </p>
                <h1 className="font-display text-[6.2rem] leading-[0.82] text-ink sm:text-[7.8rem] lg:text-[8.5rem]">{MARK}</h1>
                <p className="max-w-xl mt-4 text-base font-medium leading-7 text-ink/70">
                  Ink-on-paper dice minting for on-chain financial calligraphy. Commit first, roll through the signer, then receive exactly the amount the dice reveal.
                </p>
              </div>

              <SupplyBar minted={mint.totalMinted} maxSupply={maxSupply} />

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric icon={<Dice5 size={18} />} label="State" value={stateLabel(mint.mintState)} />
                <Metric icon={<RefreshCcw size={18} />} label="Attempts" value={`${mint.attemptCount}/2`} />
                <Metric icon={<Coins size={18} />} label="Supply" value={supplyText} />
              </div>

              <div className="grid gap-4 ledger-card">
                <MintSteps mint={mint} diceResult={mint.diceResult} />
                <WalletLedger mint={mint} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Price label="Commit fee" value={mint.commitFee} />
                  <Price label="Mint price" value={mint.mintPrice} />
                  <Price label="Wallet balance" value={mint.walletBalance} />
                  <Price label="Mint payment" value={mint.mintPrice} />
                </div>
                {/* <p className="fixed-price-note">
                  Mint price is fixed. You pay the same amount whether the die rolls 1 or 6.
                </p> */}
                <button
                  className="primary-button"
                  disabled={mint.isBusy || mint.primaryState === "unconfigured" || mint.primaryState === "minted" || !mint.hasWallet}
                  onClick={mint.handlePrimaryAction}
                  type="button"
                >
                  {mint.isBusy ? <Loader2 className="animate-spin" size={20} /> : <PlugZap size={20} />}
                  {actionCopy[mint.primaryState]}
                </button>
                <MarketplaceLink className="opensea-button" label="Trade on OpenSea" />
                <SystemNotices mint={mint} />
              </div>
            </div>
          </section>

          <section className="grid min-h-screen grid-rows-[minmax(420px,58vh)_minmax(0,1fr)] bg-paper-light/80 lg:h-screen lg:min-h-0">
            <div className="relative min-h-[420px] overflow-hidden border-b border-ink/10">
              <div className="absolute left-6 top-5 z-10 flex items-center gap-2 rounded-sm bg-paper/75 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-ink/50 backdrop-blur">
                <Dice5 size={15} />
                Drag to orbit
              </div>
              <DiceBoundary>
                <Suspense fallback={<DiceFallback label="Loading dice" />}>
                  <DiceScene result={mint.diceResult} rolling={mint.phase === "rolling"} />
                </Suspense>
              </DiceBoundary>
            </div>
            <div className="min-h-0 px-5 py-5 sm:px-8">
              <TokenGallery tokenIds={mint.tokenIds} tokens={mint.tokens} />
            </div>
          </section>
        </div>

        <StatusDrawer diceResult={mint.diceResult} open={receiveOpen} phase={mint.phase} roll={mint.roll} toggle={this.toggleReceive} txHash={mint.txHash} />
        <WalletModal
          mint={mint}
          onClose={this.closeWalletModal}
          onConnect={mint.connect}
          onCopy={this.copyAddress}
          open={walletModalOpen}
        />
      </main>
    );
  }
}

class DiceBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <DiceFallback label="Dice preview unavailable" /> : this.props.children;
  }
}

function Toast({ toast, onClose }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div animate={{ opacity: 1, y: 0 }} className={`toast toast-${toast.type}`} exit={{ opacity: 0, y: -16 }} initial={{ opacity: 0, y: -16 }} role="status">
          {toast.type === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button onClick={onClose} title="Dismiss" type="button"><X size={16} /></button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function WalletModal({ mint, onClose, onConnect, onCopy, open }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div animate={{ opacity: 1 }} className="modal-backdrop" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            animate={{ y: 0, opacity: 1 }}
            className="wallet-modal"
            exit={{ y: 18, opacity: 0 }}
            initial={{ y: 18, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cinnabar">Wallet</p>
                <h2 className="mt-2 text-xl font-black">{mint.client ? shortAddress(mint.client.address) : "Connect wallet"}</h2>
              </div>
              <button className="square-button" onClick={onClose} title="Close" type="button"><X size={18} /></button>
            </div>
            {mint.client ? (
              <>
                <div className="p-3 mt-4 font-mono text-xs font-black break-all rounded-sm bg-paper/80 text-ink/70">
                  {mint.client.address}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button className="secondary-button" onClick={onCopy} type="button"><Copy size={16} />Copy</button>
                  <button className="secondary-button" onClick={mint.disconnect} type="button"><LogOut size={16} />Disconnect</button>
                </div>
              </>
            ) : (
              <button className="mt-4 primary-button" onClick={onConnect} type="button">
                <Wallet size={18} />
                Connect Wallet
              </button>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DiceFallback({ label }) {
  return (
    <div className="grid min-h-[360px] place-items-center bg-paper px-6 text-center">
      <div className="grid gap-4">
        <div className="grid mx-auto bg-white border-2 rounded-sm h-28 w-28 place-items-center border-ink shadow-panel"><Dice5 size={48} /></div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-ink/50">{label}</p>
      </div>
    </div>
  );
}

function SupplyBar({ minted, maxSupply }) {
  const mintedNumber = Number(minted || 0n);
  const cap = Number(maxSupply || 10000n);
  const hasCap = Number.isFinite(cap) && cap > 0;
  const width = hasCap ? `${Math.min((mintedNumber / cap) * 100, 100)}%` : `${Math.min(mintedNumber * 4, 100)}%`;
  const remaining = hasCap ? Math.max(cap - mintedNumber, 0) : null;

  return (
    <div className="supply-bar">
      <div className="flex items-center justify-between gap-4">
        <span>Supply progress</span>
        <strong>{hasCap ? `${mintedNumber}/${cap}` : `${mintedNumber} minted`}</strong>
      </div>
      <div className="h-2 mt-3 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-cinnabar" style={{ width }} />
      </div>
      <p className="mt-2 text-[0.68rem] tracking-[0.12em] text-cinnabar/70">
        {hasCap ? `${remaining} Caligraphs remaining` : "Supply progress will update after wallet sync."}
      </p>
    </div>
  );
}

function MintSteps({ mint, diceResult }) {
  const steps = [
    { label: "Commit", active: mint.phase === "committing" || mint.mintState >= MintState.Committed, done: mint.mintState >= MintState.Committed },
    { label: "Roll & Mint", active: ["rolling", "minting"].includes(mint.phase) || Boolean(diceResult), done: mint.mintState === MintState.Minted },
    { label: "Receive", active: mint.mintState === MintState.Minted, done: mint.mintState === MintState.Minted }
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div className={`flow-step ${step.active ? "is-active" : ""} ${step.done ? "is-done" : ""}`} key={step.label}>
          <span>{index + 1}</span><strong>{step.label}</strong>
        </div>
      ))}
    </div>
  );
}

function WalletLedger({ mint }) {
  const connected = Boolean(mint.client);
  return (
    <div className="wallet-ledger">
      <div>
        <span>Wallet attempt</span>
        <strong>{connected ? `${mint.attemptCount}/2` : "Not connected"}</strong>
      </div>
      <div>
        <span>Your Caligraphs</span>
        <strong>{connected ? mint.walletMinted : "-"}</strong>
      </div>
      <div>
        <span>Mint access</span>
        <strong>{mint.mintState === MintState.Minted ? "Closed" : mint.mintState === MintState.Committed ? "Committed" : "Open"}</strong>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="min-w-0 ledger-tile">
      <div className="flex items-center justify-between mb-3 text-ink/50">{icon}<span className="truncate text-xs font-black uppercase tracking-[0.16em]">{label}</span></div>
      <p className="font-mono text-2xl font-black truncate" title={String(value)}>{value}</p>
    </div>
  );
}

function Price({ label, value }) {
  const text = `${ethers.formatEther(value)} ETH`;
  return (
    <div className="flex items-center justify-between min-w-0 gap-3 px-3 py-3 rounded-sm bg-paper/80">
      <span className="text-sm font-bold shrink-0 text-ink/60">{label}</span>
      <span className="min-w-0 font-mono text-sm font-black text-right truncate" title={text}>{text}</span>
    </div>
  );
}

function SystemNotices({ mint }) {
  return (
    <div className="grid gap-2">
      {!mint.hasWallet ? <p className="notice">No injected wallet detected.</p> : null}
      {!mint.contractReady ? <p className="notice">Set `VITE_CONTRACT_ADDRESS` in `.env`.</p> : null}
      {mint.mintState === MintState.Minted ? <p className="notice">This wallet has already minted and cannot mint again.</p> : null}
      {mint.isWrongChain ? (
        <div className="flex flex-col gap-3 notice sm:flex-row sm:items-center sm:justify-between">
          <span>Incorrect network. Connected to chain {mint.chainId}; switch to {APP_CONFIG.chainName}.</span>
          <button className="secondary-button" onClick={mint.switchNetwork} type="button">Switch to {APP_CONFIG.chainName}</button>
        </div>
      ) : null}
      {mint.client && mint.walletBalance <= mint.commitFee && mint.mintState !== MintState.Minted ? <p className="hidden notice">Add ETH for the commit payment and gas before minting.</p> : null}
    </div>
  );
}

function StatusDrawer({ phase, diceResult, roll, txHash, open, toggle }) {
  const isWorking = ["committing", "rolling", "minting"].includes(phase);
  return (
    <aside className={`status-drawer ${open ? "is-open" : ""}`}>
      <button className="status-drawer-tab" onClick={toggle} type="button">
        {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        <span>{open ? "Hide receive" : "Show receive"}</span>
      </button>
      <div className="status-drawer-panel">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-ink/50">Receive ledger</p><h2 className="mt-2 text-xl font-black">{statusTitle(phase, diceResult)}</h2></div>
          {isWorking ? <Loader2 className="mt-1 animate-spin text-cinnabar" size={22} /> : <CheckCircle2 className="mt-1 text-jade" size={22} />}
        </div>
        <div className="grid gap-2 mt-4 text-sm">
          <StatusRow label="Dice" value={diceResult ? `${diceResult} Caligraph${diceResult > 1 ? "s" : ""}` : roll ? "Signer roll received" : "Waiting"} />
          <StatusRow label="Reveal" value={roll ? "Secured by commit" : "Hidden until roll"} />
          <StatusRow label="Tx" txHash={txHash} value={txHash ? shortAddress(txHash) : "Not submitted"} />
        </div>
      </div>
    </aside>
  );
}

function StatusRow({ label, value, txHash }) {
  return (
    <div className="flex items-center justify-between min-w-0 gap-3 px-3 py-2 rounded-sm bg-white/60">
      <span className="font-bold shrink-0 text-ink/50">{label}</span>
      {txHash && APP_CONFIG.explorerTxUrl ? (
        <a className="inline-flex items-center min-w-0 gap-2 font-mono font-bold text-cinnabar" href={`${APP_CONFIG.explorerTxUrl}${txHash}`} rel="noreferrer" target="_blank"><span className="truncate">{value}</span><ExternalLink className="shrink-0" size={14} /></a>
      ) : (
        <span className="min-w-0 font-mono font-bold truncate" title={String(value)}>{value}</span>
      )}
    </div>
  );
}

function TokenGallery({ tokens, tokenIds }) {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-black"><ScrollText size={19} />Minted Caligraphs</h2>
        <MarketplaceLink className="icon-link" label="OpenSea" />
      </div>
      {tokenIds.length === 0 ? (
        <div className="flex-1 empty-state">Your Caligraph previews will appear here after minting.</div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 pr-2 overflow-y-auto caligraph-scroll sm:grid-cols-2 xl:grid-cols-3">
          {tokens.length === 0 ? tokenIds.map((id) => <div className="token-card animate-pulse" key={id}>Loading #{id}</div>) : tokens.map((token) => <TokenCard key={token.id} token={token} />)}
        </div>
      )}
    </div>
  );
}

function MarketplaceLink({ className, label }) {
  if (!APP_CONFIG.marketplaceUrl) return null;
  return (
    <a className={className} href={APP_CONFIG.marketplaceUrl} rel="noreferrer" target="_blank">
      <OpenSeaIcon />
      <span>{label}</span>
      <ExternalLink size={15} />
    </a>
  );
}

function OpenSeaIcon() {
  return <img alt="" aria-hidden="true" className="opensea-logo" src="/opensea-white-logo.svg" />;
}

function TokenCard({ token }) {
  return (
    <motion.article animate={{ opacity: 1, y: 0 }} className="token-card" initial={{ opacity: 0, y: 16 }}>
      <div className="overflow-hidden bg-white rounded-sm aspect-square" dangerouslySetInnerHTML={{ __html: token.imageSvg }} />
      <div className="min-w-0"><h3 className="mt-3 font-black truncate" title={token.name || `Token #${token.id}`}>{token.name || `Token #${token.id}`}</h3><p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-ink/45">Token #{token.id}</p></div>
    </motion.article>
  );
}

function statusTitle(phase, diceResult) {
  if (phase === "committing") return "Commit transaction pending";
  if (phase === "rolling") return "Dice is tumbling";
  if (phase === "minting") return diceResult ? `Minting ${diceResult} Caligraph${diceResult > 1 ? "s" : ""}` : "Mint transaction pending";
  if (diceResult) return `You rolled ${diceResult}`;
  return "Ready to commit";
}

function shapeError(message) {
  const lower = message.toLowerCase();
  if (lower.includes("too many") || lower.includes("rate limit") || lower.includes("429")) return "Too many roll requests. Please wait a minute and try again.";
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) return "The roll request timed out. Please try again.";
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) return "Could not reach the roll server. Please check your connection and try again.";
  if (lower.includes("insufficient")) return message;
  if (lower.includes("already") || lower.includes("minted")) return "This wallet has already minted.";
  if (lower.includes("maxattemptsreached")) return "This wallet has used all commit attempts.";
  if (lower.includes("badcommitfee")) return "The commit fee changed. Refresh and try again.";
  if (lower.includes("baddiceresult")) return "The dice result is invalid. Please roll again.";
  if (lower.includes("badmintpayment")) return "The mint payment does not match the fixed mint price. Refresh and try again.";
  if (lower.includes("badsignature")) return "The roll signature could not be verified. Please roll again.";
  if (lower.includes("messageused")) return "This signed roll has already been used.";
  if (lower.includes("nonceused")) return "This roll nonce has already been used.";
  if (lower.includes("notcommitted")) return "Commit first before rolling and minting.";
  if (lower.includes("soldout")) return "The collection is sold out.";
  if (lower.includes("zeroaddress")) return "A required wallet address is missing.";
  if (lower.includes("not allowed") || lower.includes("allowlist") || lower.includes("unauthorized")) return "This wallet is not allowed to mint.";
  if (lower.includes("user rejected") || lower.includes("denied")) return "Wallet request was cancelled.";
  if (lower.includes("dice")) return message;
  return message || "Something went wrong.";
}
