import { formatEther } from "viem";

type Props = {
  numEpochsToPay: number;
  onSetEpochs: (n: number) => void;
  onSelectAllDue: () => void;
  onPaySelected: () => void;
  selectedCount: number;
  selectedDueWei: bigint;
  hasRows: boolean;
  isPaying: boolean;
};

export function PayControls({
  numEpochsToPay,
  onSetEpochs,
  onSelectAllDue,
  onPaySelected,
  selectedCount,
  selectedDueWei,
  hasRows,
  isPaying
}: Props) {
  return (
    <section className="controls panel">
      <label>
        Epochs to pay
        <select value={numEpochsToPay} onChange={(e) => onSetEpochs(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <button className="btn" onClick={onSelectAllDue} disabled={!hasRows}>
        Select All Due
      </button>

      <button className="btn btn-primary" onClick={onPaySelected} disabled={!selectedCount || isPaying}>
        Pay Selected ({selectedCount})
      </button>

      <div className="totals">Selected total: {formatEther(selectedDueWei)} ETH</div>
    </section>
  );
}
