import { Address } from "viem";

export const CITIZENS_ADDRESS = "0x4F249b2DC6Cecbd549A0C354BBFc4919E8C5D3aE" as Address;
export const GAME_ADDRESS = "0xa448c7f618087dDa1a3B128cAd8A424fBae4B71F" as Address;
export const EVADERS_ADDRESS = "0x075F90FF6B89a1C164fb352BEbd0a16F55804cA2" as Address;

export const citizensAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

export const evadersAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }]
  }
] as const;

export const gameAbi = [
  {
    type: "function",
    name: "estimateTaxesToPay",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "numEpochsToPay", type: "uint8" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "payTaxes",
    stateMutability: "payable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "numEpochsToPay", type: "uint8" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "auditDueTimestamp",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "lastEpochPaid",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "currentEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "getCurrentTaxRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "startTime",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }]
  },
  {
    type: "function",
    name: "audit",
    stateMutability: "payable",
    inputs: [
      { name: "fromTokenId", type: "uint256" },
      { name: "targetTokenId", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "AUDIT_COST",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export type CitizenMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
};

export type CitizenDashboardRow = {
  tokenId: bigint;
  imageUrl: string | null;
  metadata: CitizenMetadata | null;
  /** Cost for 1 epoch (actual from contract when behind, projected when caught up) */
  dueWei: bigint;
  dueEth: string;
  /** Per-epoch rate for this citizen (used to scale cost for N epochs) */
  baseRateWei: bigint;
  /** true when dueWei is a client-side projection (citizen is caught up, contract returns 0) */
  projected: boolean;
  auditDueTimestamp: bigint;
  lastEpochPaid: bigint;
};

export type EvaderDashboardRow = {
  tokenId: bigint;
  imageUrl: string | null;
  metadata: CitizenMetadata | null;
};

export type AuditTarget = {
  tokenId: bigint;
  lastEpochPaid: bigint;
  epochsBehind: number;
  alreadyUnderAudit: boolean;
  owner: string;
};

export type CartItem = {
  tokenId: bigint;
  status: "pending" | "executing" | "done" | "failed";
  txHash?: `0x${string}`;
  error?: string;
};

export function toHttpUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
}
