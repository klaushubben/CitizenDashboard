# d/t: tax dashboard

A wallet-connected dashboard for [Death and Taxes](https://deptof.death) on Ethereum mainnet.

## Features

- **Wallet connection** via Reown AppKit or injected wallets (MetaMask, etc.)
- **Citizen inventory** — loads all owned Citizens with on-chain metadata, IPFS images, and trait badges
- **Tax overview** — per-token tax due, last epoch paid, runway visualization, and audit status
- **Game stats** — current epoch, countdown to next epoch, tax rate, due/evader counts
- **Batch pay** — select multiple Citizens and pay taxes sequentially (one tx per token)
- **Evader gallery** — browse owned Evader NFTs with metadata and trait details
- **Browser notifications** — alerts when a token transitions to taxes due or audit state
- **Manual refresh** — chain data loads once on connect; refresh on demand to avoid RPC rate limits

## Constraints

- **Non-custodial**: no private keys are stored by the app.
- `payTaxes(tokenId, numEpochsToPay)` is single-token per transaction.
- "Pay Selected" sends sequential individual tx requests; it does not batch on-chain.
- Gas savings come from choosing higher `numEpochsToPay` (fewer future txs), not from multi-token batching.
- The Citizens contract is basic ERC721 (no Enumerable), so token discovery uses a chunked `ownerOf` scan across all 6969 tokens. Results are cached per session.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

Set `VITE_WALLETCONNECT_PROJECT_ID` to your Reown Cloud project ID.
If omitted, the app will still run with injected wallets only (no Reown QR modal).

3. Run:

```bash
npm run dev
```

## Contracts

| Contract | Address |
|----------|---------|
| Citizens | `0x4F249b2DC6Cecbd549A0C354BBFc4919E8C5D3aE` |
| Game (DeathAndTaxes) | `0xa448c7f618087dDa1a3B128cAd8A424fBae4B71F` |
| Evaders | `0x075F90FF6B89a1C164fb352BEbd0a16F55804cA2` |

Chain: Ethereum Mainnet

## Stack

- React 18 + TypeScript
- Vite
- wagmi v2 + viem
- TanStack React Query
- WalletConnect (Reown AppKit)
