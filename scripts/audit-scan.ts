#!/usr/bin/env npx tsx
/**
 * Scan all citizens and list those open for auditing.
 *
 * Usage:
 *   npx tsx scripts/audit-scan.ts
 *
 * Options:
 *   --json     Output as JSON instead of a table
 *   --open     Only show targets NOT already under audit
 */

import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";

const CITIZENS_ADDRESS = "0x4F249b2DC6Cecbd549A0C354BBFc4919E8C5D3aE" as const;
const GAME_ADDRESS = "0xa448c7f618087dDa1a3B128cAd8A424fBae4B71F" as const;

const citizensAbi = [
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "address" }] },
] as const;

const gameAbi = [
  { type: "function", name: "currentEpoch", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "lastEpochPaid", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "auditDueTimestamp", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "AUDIT_COST", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

const CHUNK = 500;

async function main() {
  const jsonOut = process.argv.includes("--json");
  const openOnly = process.argv.includes("--open");

  const client = createPublicClient({
    chain: mainnet,
    transport: http("https://ethereum-rpc.publicnode.com"),
  });

  const [currentEpoch, supply, auditCost] = (await client.multicall({
    contracts: [
      { address: GAME_ADDRESS, abi: gameAbi, functionName: "currentEpoch" },
      { address: CITIZENS_ADDRESS, abi: citizensAbi, functionName: "totalSupply" },
      { address: GAME_ADDRESS, abi: gameAbi, functionName: "AUDIT_COST" },
    ],
    allowFailure: false,
  })) as [bigint, bigint, bigint];

  const total = Number(supply);
  const threshold = currentEpoch - 1n;

  if (!jsonOut) {
    console.log(`Epoch: ${currentEpoch}  |  Supply: ${total}  |  Audit cost: ${formatEther(auditCost)} ETH`);
    console.log(`Auditable = lastEpochPaid < ${threshold}\n`);
  }

  if (currentEpoch <= 1n) {
    console.log("Epoch 1 — nobody can be behind yet.");
    return;
  }

  type Target = { tokenId: number; owner: string; lastEpochPaid: number; epochsBehind: number; underAudit: boolean };
  const targets: Target[] = [];

  for (let start = 1; start <= total; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, total);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i));

    if (!jsonOut) process.stdout.write(`\rScanning ${end}/${total}...`);

    const lastEpochResults = await client.multicall({
      contracts: ids.map((id) => ({ address: GAME_ADDRESS, abi: gameAbi, functionName: "lastEpochPaid" as const, args: [id] })),
      allowFailure: true,
    });

    const behindIds: bigint[] = [];
    const behindEpochs: bigint[] = [];
    for (let i = 0; i < ids.length; i++) {
      const r = lastEpochResults[i];
      if (r.status === "success") {
        const lastPaid = r.result as bigint;
        if (lastPaid < threshold) {
          behindIds.push(ids[i]);
          behindEpochs.push(lastPaid);
        }
      }
    }

    if (behindIds.length > 0) {
      const [auditResults, ownerResults] = await Promise.all([
        client.multicall({
          contracts: behindIds.map((id) => ({ address: GAME_ADDRESS, abi: gameAbi, functionName: "auditDueTimestamp" as const, args: [id] })),
          allowFailure: true,
        }),
        client.multicall({
          contracts: behindIds.map((id) => ({ address: CITIZENS_ADDRESS, abi: citizensAbi, functionName: "ownerOf" as const, args: [id] })),
          allowFailure: true,
        }),
      ]);

      for (let j = 0; j < behindIds.length; j++) {
        const underAudit = auditResults[j].status === "success" && (auditResults[j].result as bigint) > 0n;
        if (openOnly && underAudit) continue;

        const owner = ownerResults[j].status === "success" ? (ownerResults[j].result as string) : "unknown";
        targets.push({
          tokenId: Number(behindIds[j]),
          owner,
          lastEpochPaid: Number(behindEpochs[j]),
          epochsBehind: Number(currentEpoch - behindEpochs[j] - 1n),
          underAudit,
        });
      }
    }
  }

  // Sort: not-yet-audited first, then most behind
  targets.sort((a, b) => {
    if (a.underAudit !== b.underAudit) return a.underAudit ? 1 : -1;
    return b.epochsBehind - a.epochsBehind;
  });

  if (jsonOut) {
    console.log(JSON.stringify(targets, null, 2));
    return;
  }

  process.stdout.write("\r" + " ".repeat(40) + "\r");

  if (targets.length === 0) {
    console.log("No auditable citizens found. Everyone is current.");
    return;
  }

  const open = targets.filter((t) => !t.underAudit).length;
  console.log(`${targets.length} auditable — ${open} open, ${targets.length - open} already under audit\n`);

  console.log(
    "Token".padEnd(8) +
    "Owner".padEnd(44) +
    "Last Paid".padEnd(12) +
    "Behind".padEnd(9) +
    "Status"
  );
  console.log("-".repeat(85));

  for (const t of targets) {
    console.log(
      `#${t.tokenId}`.padEnd(8) +
      t.owner.padEnd(44) +
      t.lastEpochPaid.toString().padEnd(12) +
      t.epochsBehind.toString().padEnd(9) +
      (t.underAudit ? "UNDER AUDIT" : "OPEN")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
