import { CitizenDashboardRow } from "./contracts";

export function attrValue(row: CitizenDashboardRow, key: string): string {
  const found = row.metadata?.attributes?.find((a) => (a.trait_type ?? "").toLowerCase() === key.toLowerCase());
  return String(found?.value ?? "-");
}

export function classBadgeClass(className: string): string {
  const c = className.toLowerCase();
  if (c.includes("bureaucrat")) return "badge-red";
  if (c.includes("wealthy")) return "badge-gold";
  if (c.includes("commoner")) return "badge-stone";
  return "badge-neutral";
}

export function runwayEpochs(row: CitizenDashboardRow, currentEpoch: bigint): number {
  if (currentEpoch <= 0n) return 0;
  const ahead = row.lastEpochPaid - currentEpoch;
  return Number(ahead > 0n ? ahead : 0n);
}

export function isAuditable(row: CitizenDashboardRow, currentEpoch: bigint): boolean {
  return currentEpoch > 1n && row.lastEpochPaid < currentEpoch - 1n;
}

export function isUnderAudit(row: CitizenDashboardRow): boolean {
  return row.auditDueTimestamp > 0n;
}

export function countdownLabel(seconds: number | null): string {
  if (seconds === null) return "--:--:--";
  const s = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function shortTxError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("User rejected")) return "Transaction rejected by user.";
    if (err.message.includes("insufficient funds")) return "Insufficient funds.";
    const short = err.message.slice(0, 120);
    return short.length < err.message.length ? short + "..." : short;
  }
  return "Unknown error.";
}
