import { CitizenDashboardRow } from "../lib/contracts";
import { attrValue, classBadgeClass, runwayEpochs, isAuditable, isUnderAudit } from "../lib/citizen-utils";

type Props = {
  rows: CitizenDashboardRow[];
  currentEpoch: bigint | null;
  numEpochsToPay: number;
  selectedTokenIds: Set<string>;
  onToggleToken: (tokenId: bigint) => void;
  isConnected: boolean;
};

const COL_COUNT = 7;

export function CitizenSection({
  rows,
  currentEpoch,
  numEpochsToPay,
  selectedTokenIds,
  onToggleToken,
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
                  <th></th>
                  <th>Token</th>
                  <th>Class</th>
                  <th>Last Paid</th>
                  <th>Due ({numEpochsToPay} ep)</th>
                  <th>Being Audited?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const cls = attrValue(row, "class");
                  const urgent = currentEpoch !== null ? isUnderAudit(row) || isAuditable(row, currentEpoch) : false;
                  const runway = currentEpoch !== null ? runwayEpochs(row, currentEpoch) : 0;
                  const pct = Math.min(100, Math.max(0, (runway / 7) * 100));
                  const key = row.tokenId.toString();
                  return (
                    <>
                      <tr key={key} className={urgent ? "urgent-row" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedTokenIds.has(key)}
                            onChange={() => onToggleToken(row.tokenId)}
                          />
                        </td>
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
                        <td>{row.lastEpochPaid.toString()}</td>
                        <td>{row.dueEth} ETH</td>
                        <td>{isUnderAudit(row) ? "YES" : "NO"}</td>
                      </tr>
                      <tr key={`${key}-runway`} className="runway-tr">
                        <td colSpan={COL_COUNT} className="runway-cell">
                          <div className="runway-bar">
                            <div className="runway-fill" style={{ width: `${pct}%` }} />
                            <span className="runway-text">{runway} ep ahead</span>
                          </div>
                        </td>
                      </tr>
                    </>
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
