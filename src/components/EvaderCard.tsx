import { EvaderDashboardRow } from "../lib/contracts";

type Props = {
  row: EvaderDashboardRow;
  onOpenDetails: (tokenId: bigint) => void;
};

export function EvaderCard({ row, onOpenDetails }: Props) {
  return (
    <article className="card evader-card">
      <div className="card-body">
        <div className="image-wrap">
          {row.imageUrl ? <img src={row.imageUrl} alt={row.metadata?.name ?? "Evader"} /> : <div className="image-fallback">No image</div>}
        </div>

        <div className="card-info">
          <h3>{row.metadata?.name ?? `Evader #${row.tokenId.toString()}`}</h3>
          <p className="muted">Evader Token #{row.tokenId.toString()}</p>
          <div className="traits">
            {(row.metadata?.attributes ?? []).slice(0, 6).map((attr, idx) => (
              <span key={`${String(row.tokenId)}-${idx}`} className="trait-pill">
                {attr.trait_type ?? "Trait"}: {String(attr.value ?? "-")}
              </span>
            ))}
          </div>
          <button className="btn" onClick={() => onOpenDetails(row.tokenId)}>
            View Details
          </button>
        </div>
      </div>
    </article>
  );
}
