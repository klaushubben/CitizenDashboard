import type { Connector } from "wagmi";

type Props = {
  connectors: readonly Connector[];
  onConnect: (connector: Connector) => void;
  onClose: () => void;
};

function displayConnectorName(name: string): string {
  if (name.toLowerCase() === "injected") return "Browser Wallet";
  return name;
}

export function ConnectModal({ connectors, onConnect, onClose }: Props) {
  return (
    <div className="connect-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="connect-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connect-modal-header">
          <h3>Choose Wallet</h3>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="connect-modal-list">
          {connectors.map((connector) => (
            <button key={connector.uid} className="btn" onClick={() => onConnect(connector)}>
              {displayConnectorName(connector.name)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
