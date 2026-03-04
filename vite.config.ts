import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (
            id.includes("@walletconnect") ||
            id.includes("@reown") ||
            id.includes("@wagmi/connectors") ||
            id.includes("@coinbase") ||
            id.includes("viem")
          ) {
            return "wallet-stack";
          }

          if (id.includes("@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          return "vendor";
        }
      }
    }
  }
});
