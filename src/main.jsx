import React from "react";
import { createRoot } from "react-dom/client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { walletAppInfo, walletConfig } from "./walletConfig";
import "./styles.css";

const rootElement = document.getElementById("root");
const queryClient = new QueryClient();

window.addEventListener("error", (event) => {
  if (isIgnoredRuntimeNoise(event.message)) {
    event.preventDefault();
    return;
  }
  showBootError(event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (isIgnoredRuntimeNoise(event.reason?.message || String(event.reason || ""))) {
    event.preventDefault();
    return;
  }
  showBootError(event.reason);
});

import("./App.jsx")
  .then(({ default: App }) => {
    createRoot(rootElement).render(
      <WagmiProvider config={walletConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            appInfo={walletAppInfo}
            modalSize="compact"
            theme={darkTheme({
              accentColor: "#b63326",
              accentColorForeground: "#f8f2e7",
              borderRadius: "small",
              fontStack: "system"
            })}
          >
            <React.StrictMode>
              <App />
            </React.StrictMode>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  })
  .catch(showBootError);

function showBootError(error) {
  const message = error?.message || String(error || "Unknown frontend error");
  rootElement.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;background:#f5f1e8;color:#111;font-family:Inter,system-ui,sans-serif;padding:24px">
      <section style="max-width:680px;border:1px solid rgba(17,17,17,.14);background:white;border-radius:8px;padding:24px;box-shadow:0 24px 70px rgba(17,17,17,.12)">
        <p style="margin:0 0 8px;font-size:12px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#d1462f">Frontend failed to load</p>
        <h1 style="margin:0 0 12px;font-size:30px;line-height:1.05">Financial Calligraphy Disc</h1>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#f5f1e8;border-radius:6px;padding:12px;font-size:13px;line-height:1.5">${escapeHtml(message)}</pre>
      </section>
    </main>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isIgnoredRuntimeNoise(message) {
  const lower = message.toLowerCase();
  return (
    lower.includes("resizeobserver loop") ||
    lower.includes("resize observer loop") ||
    lower.includes("undelivered notifications") ||
    lower.includes("not found rainbowkit") ||
    lower.includes("rainbowkit")
  );
}
