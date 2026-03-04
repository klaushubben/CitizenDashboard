import { EVADERS_ADDRESS, EvaderDashboardRow } from "../lib/contracts";

type Props = {
  row: EvaderDashboardRow;
  onClose: () => void;
};

function getEtherscanTokenLink(contract: string, tokenId: bigint): string {
  return `https://etherscan.io/token/${contract}?a=${tokenId.toString()}`;
}

function getOpenSeaAssetLink(contract: string, tokenId: bigint): string {
  return `https://opensea.io/assets/ethereum/${contract}/${tokenId.toString()}`;
}

export function EvaderDetailDrawer({ row, onClose }: Props) {
  const contract = EVADERS_ADDRESS;

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label="Evader details">
      <aside className="drawer">
        <header className="drawer-header">
          <h3>{row.metadata?.name ?? `Evader #${row.tokenId.toString()}`}</h3>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="drawer-content">
          <div className="drawer-image-wrap">
            {row.imageUrl ? <img src={row.imageUrl} alt={row.metadata?.name ?? "Evader"} /> : <div className="image-fallback">No image</div>}
          </div>

          <p className="muted">Token ID: {row.tokenId.toString()}</p>
          {row.metadata?.description ? <p>{row.metadata.description}</p> : null}

          <div className="drawer-links">
            <a className="btn" href={getOpenSeaAssetLink(contract, row.tokenId)} target="_blank" rel="noreferrer noopener">
              OpenSea
            </a>
            <a className="btn" href={getEtherscanTokenLink(contract, row.tokenId)} target="_blank" rel="noreferrer noopener">
              Etherscan
            </a>
          </div>

          <section>
            <h4>Traits</h4>
            {(row.metadata?.attributes?.length ?? 0) > 0 ? (
              <ul className="trait-list">
                {(row.metadata?.attributes ?? []).map((attr, idx) => (
                  <li key={`${row.tokenId.toString()}-trait-${idx}`}>
                    <span>{attr.trait_type ?? "Trait"}</span>
                    <strong>{String(attr.value ?? "-")}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No traits available.</p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
