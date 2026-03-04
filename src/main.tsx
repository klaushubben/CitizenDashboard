import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http, fallback } from "wagmi";
import { mainnet } from "wagmi/chains";
import { walletConnect, injected } from "wagmi/connectors";
import App from "./App";
import "./styles.css";

// Reown still uses a WalletConnect-compatible project id env key.
const reownProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";
const hasReown = reownProjectId.trim().length > 0;

const config = createConfig({
  chains: [mainnet],
  connectors: hasReown
    ? [
        injected(),
        walletConnect({
          projectId: reownProjectId,
          showQrModal: true
        })
      ]
    : [injected()],
  transports: {
    [mainnet.id]: fallback([
      http("https://ethereum-rpc.publicnode.com"),
      http("https://eth.llamarpc.com"),
      http("https://rpc.ankr.com/eth")
    ])
  }
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
