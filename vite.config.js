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
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("ethers")) return "vendor-ethers";
          if (id.includes("three")) return "vendor-three";
          if (id.includes("motion") || id.includes("lucide-react")) return "vendor-ui";
          return "vendor";
        }
      }
    }
  }
});
