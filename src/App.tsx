import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
  useWaitForTransactionReceipt
} from "wagmi";
import { parseEther } from "viem";
import { loadDashboardRows, loadEvaderRows, invalidateOwnershipCache } from "./lib/dashboard";
import { CartItem, CitizenDashboardRow, GAME_ADDRESS, gameAbi } from "./lib/contracts";
import { shortTxError } from "./lib/citizen-utils";
import { GameOverviewBar } from "./components/GameOverviewBar";
import { StatusLine } from "./components/StatusLine";
import { CitizenSection } from "./components/CitizenSection";
import { CartPanel } from "./components/CartPanel";
import { EvaderSection } from "./components/EvaderSection";
import { EvaderDetailDrawer } from "./components/EvaderDetailDrawer";
import { ConnectModal } from "./components/ConnectModal";
import { TipFooter } from "./components/TipFooter";
// import { AuditTargets } from "./components/AuditTargets";

type NotificationSnapshot = {
  dueByToken: Map<string, bigint>;
  auditByToken: Map<string, bigint>;
};

type GameOverview = {
  currentEpoch: bigint;
  taxRate: bigint;
  startTime: bigint;
};

type TxError = {
  message: string;
  timestamp: number;
};

const POLL_MS = 30_000;
const EPOCH_SECONDS = 86_400;
const KLAUS_TIP_ADDRESS = "0x49c08159de1ae3a8b2d5Cc7BAa9A23BA9E96910C" as const;
const TIP_CONFIRM_THRESHOLD = 0.1;

function toBigInt(value: number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return Promise.resolve("denied");
  if (Notification.permission !== "default") return Promise.resolve(Notification.permission);
  return Notification.requestPermission();
}

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();

  const [citizenEpochs, setCitizenEpochs] = useState<Map<string, number>>(new Map());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();
  const [activeEvaderTokenId, setActiveEvaderTokenId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [tipAmountInput, setTipAmountInput] = useState("0.005\u039E");
  const [tipTxHash, setTipTxHash] = useState<`0x${string}` | undefined>();
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [refreshPhase, setRefreshPhase] = useState(0);
  const [txError, setTxError] = useState<TxError | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const snapshotRef = useRef<NotificationSnapshot>({
    dueByToken: new Map(),
    auditByToken: new Map()
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: isTipPending } = useSendTransaction();
  const txReceipt = useWaitForTransactionReceipt({ hash: lastTxHash });
  const tipReceipt = useWaitForTransactionReceipt({ hash: tipTxHash });

  function setCitizenEpochCount(tokenId: string, n: number): void {
    setCitizenEpochs((prev) => {
      const next = new Map(prev);
      next.set(tokenId, n);
      return next;
    });
  }

  // --- Queries ---

  const { data: gameOverview } = useQuery<GameOverview | null>({
    queryKey: ["gameOverview"],
    queryFn: async () => {
      if (!publicClient) return null;
      const [currentEpoch, taxRate, startTime] = await Promise.all([
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "currentEpoch" }),
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "getCurrentTaxRate" }),
        publicClient.readContract({ address: GAME_ADDRESS, abi: gameAbi, functionName: "startTime" })
      ]);
      return {
        currentEpoch: toBigInt(currentEpoch as number | bigint),
        taxRate: toBigInt(taxRate as number | bigint),
        startTime: toBigInt(startTime as number | bigint)
      };
    },
    enabled: Boolean(publicClient),
    refetchInterval: POLL_MS
  });

  const { data: rows = [], refetch: refetchCitizens, isFetching: isFetchingCitizens, error: rowsError } = useQuery({
    queryKey: ["citizens", address],
    queryFn: async () => {
      if (!publicClient || !address) return [];
      return loadDashboardRows(publicClient, address);
    },
    enabled: Boolean(publicClient && address)
  });

  const { data: evaderRows = [], refetch: refetchEvaders, isFetching: isFetchingEvaders, error: evaderRowsError } = useQuery({
    queryKey: ["evaders", address],
    queryFn: async () => {
      if (!publicClient || !address) return [];
      return loadEvaderRows(publicClient, address);
    },
    enabled: Boolean(publicClient && address)
  });

  const isFetchingAny = isFetchingCitizens || isFetchingEvaders;

  function refreshAllData(): void {
    invalidateOwnershipCache();
    void refetchCitizens();
    void refetchEvaders();
  }

  // --- Effects ---

  useEffect(() => {
    if (!txError) return;
    const id = window.setTimeout(() => setTxError(null), 8000);
    return () => window.clearTimeout(id);
  }, [txError]);

  useEffect(() => {
    if (isConnected) setShowConnectModal(false);
  }, [isConnected]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isFetchingAny) { setRefreshPhase(0); return; }
    const id = window.setInterval(() => setRefreshPhase((p) => (p + 1) % 6), 140);
    return () => window.clearInterval(id);
  }, [isFetchingAny]);

  useEffect(() => {
    if (!rows.length) return;
    void requestNotificationPermission().then((permission) => {
      if (permission !== "granted") return;
      const prev = snapshotRef.current;
      for (const row of rows) {
        const tokenKey = row.tokenId.toString();
        if (row.dueWei > 0n && (prev.dueByToken.get(tokenKey) ?? 0n) === 0n) {
          new Notification(`Citizen #${tokenKey} has taxes due`, { body: `${row.dueEth} ETH due.` });
        }
        if (row.auditDueTimestamp > 0n && (prev.auditByToken.get(tokenKey) ?? 0n) === 0n) {
          new Notification(`Citizen #${tokenKey} is under audit`, { body: `Audit due by ${new Date(Number(row.auditDueTimestamp) * 1000).toLocaleString()}` });
        }
      }
      snapshotRef.current = {
        dueByToken: new Map(rows.map((r) => [r.tokenId.toString(), r.dueWei])),
        auditByToken: new Map(rows.map((r) => [r.tokenId.toString(), r.auditDueTimestamp]))
      };
    });
  }, [rows]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (activeEvaderTokenId) setActiveEvaderTokenId(null);
      else if (showConnectModal) setShowConnectModal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeEvaderTokenId, showConnectModal]);

  // --- Derived ---

  const cartTokenIds = useMemo(() => new Set(cart.map((i) => i.tokenId.toString())), [cart]);
  const dueRowsCount = useMemo(() => rows.filter((r) => r.dueWei > 0n && !r.projected).length, [rows]);
  const activeEvader = useMemo(() => evaderRows.find((row) => row.tokenId.toString() === activeEvaderTokenId) ?? null, [evaderRows, activeEvaderTokenId]);

  const nextEpochSeconds = useMemo(() => {
    if (!gameOverview || gameOverview.startTime <= 0n || gameOverview.currentEpoch <= 0n) return null;
    return Number(gameOverview.startTime + BigInt(EPOCH_SECONDS) * gameOverview.currentEpoch) - nowTs;
  }, [gameOverview, nowTs]);

  // --- Cart Actions ---

  function addToCart(tokenId: bigint): void {
    setCart((prev) => {
      if (prev.some((i) => i.tokenId === tokenId)) return prev;
      return [...prev, {
        tokenId,
        status: "pending" as const
      }];
    });
  }

  function addAllToCart(): void {
    setCart((prev) => {
      const existing = new Set(prev.map((i) => i.tokenId.toString()));
      const newItems: CartItem[] = rows
        .filter((r) => !existing.has(r.tokenId.toString()))
        .map((r) => ({
          tokenId: r.tokenId,
          status: "pending" as const
        }));
      return [...prev, ...newItems];
    });
  }

  function removeFromCart(tokenId: bigint): void {
    setCart((prev) => prev.filter((i) => i.tokenId !== tokenId));
  }

  function clearDone(): void {
    setCart((prev) => prev.filter((i) => i.status !== "done"));
  }

  const executeCart = useCallback(async (): Promise<void> => {
    if (!publicClient) return;
    setIsExecuting(true);
    setTxError(null);

    const pendingItems = cart.filter((i) => i.status === "pending");
    setBatchProgress({ done: 0, total: pendingItems.length });

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      const numEpochs = citizenEpochs.get(item.tokenId.toString()) ?? 1;

      // Re-estimate via contract (fresh on-chain cost)
      try {
        const row = rows.find((r) => r.tokenId === item.tokenId);
        const freshEstimate = await publicClient.readContract({
          address: GAME_ADDRESS, abi: gameAbi,
          functionName: "estimateTaxesToPay",
          args: [item.tokenId, numEpochs]
        }) as bigint;

        if (freshEstimate === 0n) {
          // Citizen is already current or ahead — contract rejects payment until next epoch
          setCart((prev) => prev.map((c) =>
            c.tokenId === item.tokenId ? { ...c, status: "failed" as const, error: "Already paid up — wait for next epoch" } : c
          ));
          setBatchProgress({ done: i + 1, total: pendingItems.length });
          continue;
        }

        const payValue = freshEstimate;

        setCart((prev) => prev.map((c) =>
          c.tokenId === item.tokenId ? { ...c, status: "executing" as const } : c
        ));

        try {
          const hash = await writeContractAsync({
            address: GAME_ADDRESS, abi: gameAbi, functionName: "payTaxes",
            args: [item.tokenId, numEpochs], value: payValue
          });
          setLastTxHash(hash);
          setCart((prev) => prev.map((c) =>
            c.tokenId === item.tokenId ? { ...c, status: "done" as const, txHash: hash } : c
          ));
        } catch (err) {
          const errorMsg = shortTxError(err);
          setCart((prev) => prev.map((c) =>
            c.tokenId === item.tokenId ? { ...c, status: "failed" as const, error: errorMsg } : c
          ));
          setTxError({ message: `#${item.tokenId.toString()}: ${errorMsg}`, timestamp: Date.now() });
        }
      } catch (err) {
        const errorMsg = shortTxError(err);
        setCart((prev) => prev.map((c) =>
          c.tokenId === item.tokenId ? { ...c, status: "failed" as const, error: errorMsg } : c
        ));
        setTxError({ message: `#${item.tokenId.toString()}: ${errorMsg}`, timestamp: Date.now() });
      }

      setBatchProgress({ done: i + 1, total: pendingItems.length });
    }

    setBatchProgress(null);
    setIsExecuting(false);
    await refetchCitizens();
  }, [cart, citizenEpochs, rows, publicClient, writeContractAsync, refetchCitizens]);

  // --- Tip ---

  async function sendTip(): Promise<void> {
    if (!isConnected) { setShowConnectModal(true); return; }
    setTxError(null);
    const numeric = tipAmountInput.replace(/[^\d.]/g, "");
    if (!numeric || Number(numeric) <= 0) return;
    if (Number(numeric) > TIP_CONFIRM_THRESHOLD) {
      if (!window.confirm(`Send ${numeric} ETH tip? This is above ${TIP_CONFIRM_THRESHOLD} ETH.`)) return;
    }
    try {
      const hash = await sendTransactionAsync({ to: KLAUS_TIP_ADDRESS, value: parseEther(numeric) });
      setTipTxHash(hash);
    } catch (err) {
      setTxError({ message: `Tip: ${shortTxError(err)}`, timestamp: Date.now() });
    }
  }

  // --- Render ---

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <h1 className="main-title">
          <span className="dt-mark">d</span><span className="dt-slash">/</span><span className="dt-mark">t</span>
          <span className="dt-subtitle">: tax dashboard</span>
        </h1>
        <div className="wallet-panel">
          {isConnected ? (
            <>
              <span className="wallet-address">{address}</span>
              <button className="btn" onClick={() => disconnect()}>Disconnect</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setShowConnectModal(true)}>Connect Wallet</button>
          )}
          {connectError ? <p className="error">{connectError.message}</p> : null}
        </div>
      </header>

      {showConnectModal ? (
        <ConnectModal
          connectors={connectors}
          onConnect={(connector) => connect({ connector })}
          onClose={() => setShowConnectModal(false)}
        />
      ) : null}

      <GameOverviewBar
        gameOverview={gameOverview ?? null}
        nextEpochSeconds={nextEpochSeconds}
        dueRowsCount={dueRowsCount}
        evaderCount={evaderRows.length}
      />

      <StatusLine
        isFetching={isFetchingAny}
        refreshPhase={refreshPhase}
        lastTxHash={txReceipt.data?.transactionHash}
        txError={txError?.message ?? null}
        batchProgress={batchProgress}
        rowsError={rowsError}
        evaderRowsError={evaderRowsError}
        onRefresh={refreshAllData}
      />

      <CitizenSection
        rows={rows}
        currentEpoch={gameOverview?.currentEpoch ?? null}
        citizenEpochs={citizenEpochs}
        onSetCitizenEpochs={setCitizenEpochCount}
        cartTokenIds={cartTokenIds}
        onAddToCart={addToCart}
        isConnected={isConnected}
      />

      <CartPanel
        cart={cart}
        rows={rows}
        citizenEpochs={citizenEpochs}
        onAddAllToCart={addAllToCart}
        onRemoveFromCart={removeFromCart}
        onExecuteCart={() => void executeCart()}
        onClearDone={clearDone}
        isExecuting={isExecuting}
        batchProgress={batchProgress}
      />

      <EvaderSection
        evaderRows={evaderRows}
        isConnected={isConnected}
        onOpenDetails={(tokenId) => setActiveEvaderTokenId(tokenId.toString())}
      />

      {/* <AuditTargets isConnected={isConnected} ownedTokenIds={ownedTokenIds} /> */}

      <TipFooter
        tipAmountInput={tipAmountInput}
        onSetTipAmount={setTipAmountInput}
        onSendTip={() => void sendTip()}
        isTipPending={isTipPending}
        tipTxHash={tipReceipt.data?.transactionHash}
      />

      {activeEvader ? <EvaderDetailDrawer row={activeEvader} onClose={() => setActiveEvaderTokenId(null)} /> : null}
    </div>
  );
}
