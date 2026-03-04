import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { AuditTarget, GAME_ADDRESS, gameAbi } from "../lib/contracts";
import { scanAuditTargets } from "../lib/dashboard";
import { shortTxError } from "../lib/citizen-utils";

type Props = {
  isConnected: boolean;
  ownedTokenIds: bigint[];
};

export function AuditTargets({ isConnected, ownedTokenIds }: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const [targets, setTargets] = useState<AuditTarget[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ scanned: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditFromToken, setAuditFromToken] = useState<string>("");
  const [auditCost, setAuditCost] = useState<bigint | null>(null);

  async function runScan(): Promise<void> {
    if (!publicClient) return;
    setScanning(true);
    setError(null);
    setTargets(null);

    try {
      // Fetch audit cost once
      if (auditCost === null) {
        const cost = (await publicClient.readContract({
          address: GAME_ADDRESS,
          abi: gameAbi,
          functionName: "AUDIT_COST"
        })) as bigint;
        setAuditCost(cost);
      }

      const results = await scanAuditTargets(publicClient, (scanned, total) => {
        setProgress({ scanned, total });
      });
      setTargets(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }

  async function auditTarget(targetTokenId: bigint): Promise<void> {
    if (!auditFromToken || auditCost === null) return;
    setError(null);

    try {
      await writeContractAsync({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "audit",
        args: [BigInt(auditFromToken), targetTokenId],
        value: auditCost
      });
      // Mark as audited in local state
      setTargets((prev) =>
        prev?.map((t) =>
          t.tokenId === targetTokenId ? { ...t, alreadyUnderAudit: true } : t
        ) ?? null
      );
    } catch (err) {
      setError(shortTxError(err));
    }
  }

  // Default audit-from to first owned token
  const effectiveFromToken = auditFromToken || (ownedTokenIds.length > 0 ? ownedTokenIds[0].toString() : "");

  return (
    <section className="panel panel-dark audit-section">
      <div className="audit-header">
        <h2>Audit Targets</h2>
        <div className="audit-controls">
          {ownedTokenIds.length > 0 ? (
            <label className="audit-from-label">
              Audit from
              <select
                value={effectiveFromToken}
                onChange={(e) => setAuditFromToken(e.target.value)}
              >
                {ownedTokenIds.map((id) => (
                  <option key={id.toString()} value={id.toString()}>
                    #{id.toString()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="btn" onClick={() => void runScan()} disabled={scanning || !publicClient}>
            {scanning ? `Scanning... ${progress ? `${progress.scanned}/${progress.total}` : ""}` : targets ? "Re-scan" : "Scan All Citizens"}
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {targets !== null ? (
        targets.length === 0 ? (
          <div className="empty">No auditable citizens found. Everyone is current.</div>
        ) : (
          <>
            <div className="audit-summary">
              {targets.length} auditable — {targets.filter((t) => !t.alreadyUnderAudit).length} not yet audited
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Owner</th>
                    <th>Last Paid</th>
                    <th>Epochs Behind</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => (
                    <tr key={t.tokenId.toString()}>
                      <td className="token-cell">#{t.tokenId.toString()}</td>
                      <td className="owner-cell">{t.owner === "unknown" ? "?" : `${t.owner.slice(0, 6)}...${t.owner.slice(-4)}`}</td>
                      <td>{t.lastEpochPaid.toString()}</td>
                      <td>{t.epochsBehind}</td>
                      <td>{t.alreadyUnderAudit ? "UNDER AUDIT" : "OPEN"}</td>
                      <td>
                        {!t.alreadyUnderAudit && isConnected && ownedTokenIds.length > 0 ? (
                          <button
                            className="btn"
                            onClick={() => void auditTarget(t.tokenId)}
                            disabled={isPending}
                          >
                            Audit
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : !scanning ? (
        <div className="empty">Click scan to find citizens behind on taxes.</div>
      ) : null}
    </section>
  );
}
