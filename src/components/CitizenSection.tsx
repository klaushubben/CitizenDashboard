import { formatEther } from "viem";
import { CitizenDashboardRow } from "../lib/contracts";
import { estimateCostForEpochs } from "../lib/dashboard";
import { attrValue, classBadgeClass, isAuditable, isUnderAudit } from "../lib/citizen-utils";

type Props = {
  rows: CitizenDashboardRow[];
  currentEpoch: bigint | null;
  citizenEpochs: Map<string, number>;
  onSetCitizenEpochs: (tokenId: string, n: number) => void;
  cartTokenIds: Set<string>;
  onAddToCart: (tokenId: bigint) => void;
  isConnected: boolean;
};

const PAST_DOTS = 3;
const FUTURE_DOTS = 7;

type DotKind = "paid" | "behind" | "current-paid" | "current-unpaid" | "preview" | "future";

function EpochDots({
  lastEpochPaid,
  currentEpoch,
  numEpochsToPay
}: {
  lastEpochPaid: bigint;
  currentEpoch: bigint;
  numEpochsToPay: number;
}) {
  const current = Number(currentEpoch);
  const lastPaid = Number(lastEpochPaid);
  const startEpoch = current - PAST_DOTS;
  const endEpoch = current + FUTURE_DOTS;

  // Determine which epochs would be paid by the stepper (next N unpaid)
  const previewSet = new Set<number>();
  let previewCount = 0;
  for (let ep = lastPaid + 1; previewCount < numEpochsToPay && ep <= endEpoch + 10; ep++) {
    previewSet.add(ep);
    previewCount++;
  }

  const dots: Array<{ epoch: number; kind: DotKind }> = [];
  for (let ep = startEpoch; ep <= endEpoch; ep++) {
    const isPaid = ep <= lastPaid;
    const isCurrent = ep === current;
    const isBehind = ep < current && !isPaid;
    const isPreview = !isPaid && previewSet.has(ep) && !isCurrent;

    if (isCurrent) {
      dots.push({ epoch: ep, kind: isPaid ? "current-paid" : "current-unpaid" });
    } else if (isPaid) {
      dots.push({ epoch: ep, kind: "paid" });
    } else if (isPreview) {
      dots.push({ epoch: ep, kind: "preview" });
    } else if (isBehind) {
      dots.push({ epoch: ep, kind: "behind" });
    } else {
      dots.push({ epoch: ep, kind: "future" });
    }
  }

  const ahead = lastPaid - current;
  const label = ahead > 0 ? `+${ahead} ahead` : ahead === 0 ? "current" : `${ahead} behind`;

  return (
    <div className="epoch-dots">
      <div className="epoch-dots-row">
        {dots.map((d) => (
          <div
            key={d.epoch}
            className={`epoch-dot epoch-dot-${d.kind}`}
            title={`Epoch ${d.epoch}`}
          />
        ))}
      </div>
      <span className={`epoch-label ${ahead < 0 ? "epoch-label-behind" : ahead > 0 ? "epoch-label-ahead" : "epoch-label-current"}`}>
        {label}
      </span>
    </div>
  );
}

function EpochStepper({
  value,
  onChange,
  row
}: {
  value: number;
  onChange: (n: number) => void;
  row: CitizenDashboardRow;
}) {
  const cost = estimateCostForEpochs(row, value);
  return (
    <div className="epoch-stepper-wrap">
      <div className="epoch-stepper">
        <button
          className="btn stepper-btn"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
        >
          -
        </button>
        <span className="stepper-value">{value}</span>
        <button
          className="btn stepper-btn"
          onClick={() => onChange(Math.min(7, value + 1))}
          disabled={value >= 7}
        >
          +
        </button>
      </div>
      <span className="stepper-cost">~{formatEther(cost)} ETH</span>
    </div>
  );
}

export function CitizenSection({
  rows,
  currentEpoch,
  citizenEpochs,
  onSetCitizenEpochs,
  cartTokenIds,
  onAddToCart,
  isConnected
}: Props) {
  return (
    <section className="panel citizens-section">
      <div className="panel-title">Citizens</div>
      <div className="table-panel">
        {isConnected ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Token</th>
                  <th>Class</th>
                  <th>Status</th>
                  <th>Audited?</th>
                  <th>Days to Pay</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const cls = attrValue(row, "class");
                  const urgent = currentEpoch !== null ? isUnderAudit(row) || isAuditable(row, currentEpoch) : false;
                  const key = row.tokenId.toString();
                  const inCart = cartTokenIds.has(key);
                  const epochs = citizenEpochs.get(key) ?? 1;
                  return (
                    <tr key={key} className={urgent ? "urgent-row" : ""}>
                      <td>
                        {row.imageUrl ? (
                          <img className="table-thumb" src={row.imageUrl} alt={row.metadata?.name ?? `Citizen #${key}`} />
                        ) : (
                          <div className="table-thumb table-thumb-fallback">—</div>
                        )}
                      </td>
                      <td className="token-cell">#{key}</td>
                      <td>
                        <span className={`class-badge ${classBadgeClass(cls)}`}>{cls}</span>
                      </td>
                      <td>
                        {currentEpoch !== null ? (
                          <EpochDots
                            lastEpochPaid={row.lastEpochPaid}
                            currentEpoch={currentEpoch}
                            numEpochsToPay={epochs}
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </td>
                      <td>{isUnderAudit(row) ? "YES" : "NO"}</td>
                      <td>
                        <EpochStepper
                          value={epochs}
                          onChange={(n) => onSetCitizenEpochs(key, n)}
                          row={row}
                        />
                      </td>
                      <td>
                        {inCart ? (
                          <span className="in-cart-badge">In Cart</span>
                        ) : (
                          <button
                            className="btn btn-add-cart"
                            onClick={() => onAddToCart(row.tokenId)}
                          >
                            Add
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">Connect a wallet to load Citizens.</div>
        )}
      </div>
    </section>
  );
}
