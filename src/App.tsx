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
import { CitizenDashboardRow, GAME_ADDRESS, gameAbi } from "./lib/contracts";
import { shortTxError } from "./lib/citizen-utils";
import { GameOverviewBar } from "./components/GameOverviewBar";
import { StatusLine } from "./components/StatusLine";
import { CitizenSection } from "./components/CitizenSection";
import { PayControls } from "./components/PayControls";
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

const DEFAULT_EPOCHS_TO_PAY = 1;
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

  const [numEpochsToPay, setNumEpochsToPay] = useState<number>(DEFAULT_EPOCHS_TO_PAY);
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<string>>(new Set());
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | undefined>();
  const [activeEvaderTokenId, setActiveEvaderTokenId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [tipAmountInput, setTipAmountInput] = useState("0.005\u039E");
  const [tipTxHash, setTipTxHash] = useState<`0x${string}` | undefined>();
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const [refreshPhase, setRefreshPhase] = useState(0);
  const [txError, setTxError] = useState<TxError | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  const snapshotRef = useRef<NotificationSnapshot>({
    dueByToken: new Map(),
    auditByToken: new Map()
  });

  const { writeContractAsync, isPending } = useWriteContract();
  const { sendTransactionAsync, isPending: isTipPending } = useSendTransaction();
  const txReceipt = useWaitForTransactionReceipt({ hash: lastTxHash });
  const tipReceipt = useWaitForTransactionReceipt({ hash: tipTxHash });

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
    queryKey: ["citizens", address, numEpochsToPay],
    queryFn: async () => {
      if (!publicClient || !address) return [];
      return loadDashboardRows(publicClient, address, numEpochsToPay);
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
          new Notification(`Citizen #${tokenKey} has taxes due`, { body: `${row.dueEth} ETH due for ${numEpochsToPay} epoch(s).` });
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
  }, [rows, numEpochsToPay]);

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

  // const ownedTokenIds = useMemo(() => rows.map((r) => r.tokenId), [rows]);
  const selectedRows = useMemo(() => rows.filter((r) => selectedTokenIds.has(r.tokenId.toString())), [rows, selectedTokenIds]);
  const selectedDueWei = useMemo(() => selectedRows.reduce((acc, row) => acc + row.dueWei, 0n), [selectedRows]);
  const dueRowsCount = useMemo(() => rows.filter((r) => r.dueWei > 0n).length, [rows]);
  const activeEvader = useMemo(() => evaderRows.find((row) => row.tokenId.toString() === activeEvaderTokenId) ?? null, [evaderRows, activeEvaderTokenId]);

  const nextEpochSeconds = useMemo(() => {
    if (!gameOverview || gameOverview.startTime <= 0n || gameOverview.currentEpoch <= 0n) return null;
    return Number(gameOverview.startTime + BigInt(EPOCH_SECONDS) * gameOverview.currentEpoch) - nowTs;
  }, [gameOverview, nowTs]);

  // --- Actions ---

  const payOne = useCallback(async (tokenId: bigint, dueWei: bigint): Promise<boolean> => {
    if (dueWei <= 0n) return true;
    setTxError(null);
    try {
      const hash = await writeContractAsync({
        address: GAME_ADDRESS, abi: gameAbi, functionName: "payTaxes",
        args: [tokenId, numEpochsToPay], value: dueWei
      });
      setLastTxHash(hash);
      return true;
    } catch (err) {
      setTxError({ message: `#${tokenId.toString()}: ${shortTxError(err)}`, timestamp: Date.now() });
      return false;
    }
  }, [writeContractAsync, numEpochsToPay]);

  async function paySelectedSequentially(): Promise<void> {
    const toPay = selectedRows.filter((r) => r.dueWei > 0n);
    if (!toPay.length) return;
    setTxError(null);
    setBatchProgress({ done: 0, total: toPay.length });

    for (let i = 0; i < toPay.length; i++) {
      const row = toPay[i];
      const ok = await payOne(row.tokenId, row.dueWei);
      if (ok) {
        setSelectedTokenIds((prev) => { const next = new Set(prev); next.delete(row.tokenId.toString()); return next; });
      }
      setBatchProgress({ done: i + 1, total: toPay.length });
      if (!ok) { setBatchProgress(null); return; }
    }
    setBatchProgress(null);
    await refetchCitizens();
  }

  function toggleToken(tokenId: bigint): void {
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      const key = tokenId.toString();
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAllDue(): void {
    setSelectedTokenIds(new Set(rows.filter((r) => r.dueWei > 0n).map((r) => r.tokenId.toString())));
  }

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
        numEpochsToPay={numEpochsToPay}
        selectedTokenIds={selectedTokenIds}
        onToggleToken={toggleToken}
        isConnected={isConnected}
      />

      <PayControls
        numEpochsToPay={numEpochsToPay}
        onSetEpochs={setNumEpochsToPay}
        onSelectAllDue={selectAllDue}
        onPaySelected={() => void paySelectedSequentially()}
        selectedCount={selectedRows.length}
        selectedDueWei={selectedDueWei}
        hasRows={rows.length > 0}
        isPaying={isPending}
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
