import { formatEther } from "viem";
import { countdownLabel } from "../lib/citizen-utils";

type GameOverview = {
  currentEpoch: bigint;
  taxRate: bigint;
  startTime: bigint;
};

type Props = {
  gameOverview: GameOverview | null;
  nextEpochSeconds: number | null;
  dueRowsCount: number;
  evaderCount: number;
};

export function GameOverviewBar({ gameOverview, nextEpochSeconds, dueRowsCount, evaderCount }: Props) {
  return (
    <section className="overview-grid">
      <article className="metric-card">
        <div className="metric-label">Current Epoch</div>
        <div className="metric-value">{gameOverview ? gameOverview.currentEpoch.toString() : "—"}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Next Epoch In</div>
        <div className="metric-value tabnum">{countdownLabel(nextEpochSeconds)}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Tax Rate / Epoch</div>
        <div className="metric-value">
          {gameOverview ? formatEther(gameOverview.taxRate) : "—"} <span className="metric-unit">ETH</span>
        </div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Citizens With Taxes Owed</div>
        <div className="metric-value">{dueRowsCount}</div>
      </article>
      <article className="metric-card">
        <div className="metric-label">Evaders Owned</div>
        <div className="metric-value">{evaderCount}</div>
      </article>
    </section>
  );
}
