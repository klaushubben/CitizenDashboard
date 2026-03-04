type Props = {
  isFetching: boolean;
  refreshPhase: number;
  lastTxHash?: string;
  txError: string | null;
  batchProgress: { done: number; total: number } | null;
  rowsError: Error | null;
  evaderRowsError: Error | null;
  onRefresh: () => void;
};

export function StatusLine({ isFetching, refreshPhase, lastTxHash, txError, batchProgress, rowsError, evaderRowsError, onRefresh }: Props) {
  return (
    <section className="status-line panel panel-dark">
      <span className="refresh-line">
        <span className="refresh-bars" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={`bar-${i}`} className={i === refreshPhase && isFetching ? "bar-active" : ""}>
              |
            </span>
          ))}
        </span>
        <span>{isFetching ? "Refreshing..." : "Loaded."}</span>
      </span>
      <button className="btn btn-refresh" onClick={onRefresh} disabled={isFetching}>
        Refresh Data
      </button>
      {lastTxHash ? <span>Last tx: {lastTxHash}</span> : null}
      {txError ? <span className="error">{txError}</span> : null}
      {batchProgress ? <span>Batch: {batchProgress.done}/{batchProgress.total}</span> : null}
      {rowsError ? <span className="error">Citizen query error: {rowsError.message}</span> : null}
      {evaderRowsError ? <span className="error">Evader query error: {evaderRowsError.message}</span> : null}
    </section>
  );
}
