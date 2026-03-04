import { EvaderDashboardRow } from "../lib/contracts";
import { EvaderCard } from "./EvaderCard";

type Props = {
  evaderRows: EvaderDashboardRow[];
  isConnected: boolean;
  onOpenDetails: (tokenId: bigint) => void;
};

export function EvaderSection({ evaderRows, isConnected, onOpenDetails }: Props) {
  return (
    <section className="evaders-section panel panel-dark">
      <h2>Evaders</h2>
      {isConnected ? (
        evaderRows.length ? (
          <div className="grid">
            {evaderRows.map((row) => (
              <EvaderCard key={row.tokenId.toString()} row={row} onOpenDetails={onOpenDetails} />
            ))}
          </div>
        ) : (
          <div className="empty">No Evaders currently in this wallet.</div>
        )
      ) : (
        <div className="empty">Connect a wallet to view Evaders.</div>
      )}
    </section>
  );
}
