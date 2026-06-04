import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: true,
    reportCompressedSize: true,
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("@rainbow-me") ||
            id.includes("@tanstack/react-query") ||
            id.includes("@wagmi") ||
            id.includes("@walletconnect") ||
            id.includes("@reown") ||
            id.includes("@coinbase") ||
            id.includes("@metamask") ||
            id.includes("@safe-global") ||
            id.includes("wagmi") ||
            id.includes("viem") ||
            id.includes("\\ox\\") ||
            id.includes("/ox/")
          ) {
            return "vendor-wallet";
          }
          if (id.includes("react-dom") || id.includes("react/") || id.endsWith("react/index.js") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("ethers")) return "vendor-ethers";
          if (id.includes("three")) return "vendor-three";
          if (id.includes("motion") || id.includes("lucide-react")) return "vendor-ui";
          return "vendor";
        }
      }
    }
  }
});
