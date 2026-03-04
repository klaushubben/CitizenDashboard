import { formatEther } from "viem";
import { CartItem, CitizenDashboardRow } from "../lib/contracts";
import { estimateCostForEpochs } from "../lib/dashboard";

type Props = {
  cart: CartItem[];
  rows: CitizenDashboardRow[];
  citizenEpochs: Map<string, number>;
  onAddAllToCart: () => void;
  onRemoveFromCart: (tokenId: bigint) => void;
  onExecuteCart: () => void;
  onClearDone: () => void;
  isExecuting: boolean;
  batchProgress: { done: number; total: number } | null;
};

export function CartPanel({
  cart,
  rows,
  citizenEpochs,
  onAddAllToCart,
  onRemoveFromCart,
  onExecuteCart,
  onClearDone,
  isExecuting,
  batchProgress
}: Props) {
  function findRow(tokenId: bigint): CitizenDashboardRow | undefined {
    return rows.find((r) => r.tokenId === tokenId);
  }

  function getEpochs(tokenId: bigint): number {
    return citizenEpochs.get(tokenId.toString()) ?? 1;
  }

  function getEstimatedWei(tokenId: bigint): bigint {
    const row = findRow(tokenId);
    if (!row) return 0n;
    return estimateCostForEpochs(row, getEpochs(tokenId));
  }

  const totalEstimated = cart.reduce((acc, item) => acc + getEstimatedWei(item.tokenId), 0n);
  const pendingCount = cart.filter((i) => i.status === "pending").length;
  const doneCount = cart.filter((i) => i.status === "done").length;

  return (
    <section className="cart-panel panel">
      <div className="cart-header">
        <div className="panel-title">Tax Cart</div>
        <div className="cart-controls">
          <button className="btn" onClick={onAddAllToCart} disabled={rows.length === 0}>
            Select All
          </button>
        </div>
      </div>

      <p className="cart-hint">Pay 1 epoch to catch up, or up to 7 to prepay ahead. Citizens already current must wait for the next epoch.</p>

      {cart.length === 0 ? (
        <div className="empty">No citizens in cart. Add citizens from the table above.</div>
      ) : (
        <>
          <div className="cart-list">
            {cart.map((item) => {
              const row = findRow(item.tokenId);
              const key = item.tokenId.toString();
              const epochs = getEpochs(item.tokenId);
              const estWei = getEstimatedWei(item.tokenId);
              return (
                <div key={key} className={`cart-item cart-item-${item.status}`}>
                  <div className="cart-item-left">
                    {row?.imageUrl ? (
                      <img className="table-thumb" src={row.imageUrl} alt={`Citizen #${key}`} />
                    ) : (
                      <div className="table-thumb table-thumb-fallback">—</div>
                    )}
                    <div className="cart-item-info">
                      <span className="cart-item-token">#{key}</span>
                      <span className="cart-item-epochs">{epochs} {epochs === 1 ? "day" : "days"}</span>
                      <span className="cart-item-cost">
                        ~{formatEther(estWei)} ETH
                      </span>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <span className={`cart-status cart-status-${item.status}`}>
                      {item.status === "pending" && (row?.projected ? "waiting for next epoch" : "ready")}
                      {item.status === "executing" && "executing..."}
                      {item.status === "done" && "done"}
                      {item.status === "failed" && (item.error ?? "failed")}
                    </span>
                    {item.txHash ? (
                      <span className="cart-item-tx" title={item.txHash}>
                        tx: {item.txHash.slice(0, 8)}...
                      </span>
                    ) : null}
                    {item.status !== "executing" ? (
                      <button
                        className="btn cart-remove-btn"
                        onClick={() => onRemoveFromCart(item.tokenId)}
                        title="Remove from cart"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cart-footer">
            <div className="cart-total">
              Est. total: ~{formatEther(totalEstimated)} ETH
            </div>

            {batchProgress ? (
              <div className="cart-progress">
                {batchProgress.done}/{batchProgress.total} processed
              </div>
            ) : null}

            <div className="cart-actions">
              {doneCount > 0 ? (
                <button className="btn" onClick={onClearDone}>
                  Clear Done ({doneCount})
                </button>
              ) : null}
              <button
                className="btn btn-primary"
                onClick={onExecuteCart}
                disabled={pendingCount === 0 || isExecuting}
              >
                Execute Cart ({pendingCount})
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
