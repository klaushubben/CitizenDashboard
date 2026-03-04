# Death and Taxes Dashboard (Non-Custodial)

A wallet-connected dashboard for Death and Taxes on Ethereum mainnet.

## Goals

- User signs in with wallet (Reown AppKit or injected wallet).
- Dashboard loads owned Citizens with image + trait metadata.
- Dashboard loads owned Evaders with image + trait metadata.
- Shows per-token tax due, audit status, and game overview.
- User manually approves `payTaxes` transactions.
- Browser notifications while the page remains open.

## Important constraints

- This is non-custodial: no private keys are stored by the app.
- `payTaxes(tokenId, numEpochsToPay)` is single-token per transaction.
- "Pay Selected" sends sequential individual tx requests; it does not batch onchain.
- Gas savings come mainly from choosing higher `numEpochsToPay` (fewer future txs), not from multi-token batching.

## Setup

1. From this directory:

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

## Network and contracts

- Chain: Ethereum Mainnet
- RPC: `https://ethereum-rpc.publicnode.com`
- Citizens: `0x4F249b2DC6Cecbd549A0C354BBFc4919E8C5D3aE`
- Game: `0xa448c7f618087dDa1a3B128cAd8A424fBae4B71F`

## Notification behavior

- On first load, app requests browser notification permission.
- While open, it polls every 30s and notifies when:
  - a token transitions from no dues to dues,
  - a token transitions into active audit state.
