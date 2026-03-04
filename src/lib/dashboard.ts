import { Address, PublicClient, formatEther } from "viem";
import {
  CITIZENS_ADDRESS,
  CitizenDashboardRow,
  CitizenMetadata,
  EVADERS_ADDRESS,
  EvaderDashboardRow,
  GAME_ADDRESS,
  citizensAbi,
  evadersAbi,
  gameAbi,
  toHttpUri
} from "./contracts";

// --- Token ID cache ---
// The ownerOf scan is expensive (~14 multicalls for 6969 tokens).
// Cache discovered token IDs until the user explicitly refreshes.

const OWNER_SCAN_CHUNK = 500;

type OwnershipCache = {
  owner: string;
  tokenIds: bigint[];
};

let citizenCache: OwnershipCache | null = null;

export function invalidateOwnershipCache(): void {
  citizenCache = null;
}

async function findOwnedTokenIds(
  publicClient: PublicClient,
  owner: Address
): Promise<bigint[]> {
  // Return cached IDs if we have them for this owner
  if (citizenCache && citizenCache.owner.toLowerCase() === owner.toLowerCase()) {
    return citizenCache.tokenIds;
  }

  const [balance, supply] = (await publicClient.multicall({
    contracts: [
      { address: CITIZENS_ADDRESS, abi: citizensAbi, functionName: "balanceOf", args: [owner] },
      { address: CITIZENS_ADDRESS, abi: citizensAbi, functionName: "totalSupply" }
    ],
    allowFailure: false
  })) as [bigint, bigint];

  if (balance === 0n) {
    citizenCache = { owner, tokenIds: [] };
    return [];
  }

  const expected = Number(balance);
  const max = Number(supply);
  const owned: bigint[] = [];

  for (let start = 1; start <= max; start += OWNER_SCAN_CHUNK) {
    const end = Math.min(start + OWNER_SCAN_CHUNK - 1, max);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => BigInt(start + i));

    const results = await publicClient.multicall({
      contracts: ids.map((id) => ({
        address: CITIZENS_ADDRESS,
        abi: citizensAbi,
        functionName: "ownerOf" as const,
        args: [id]
      })),
      allowFailure: true
    });

    for (let i = 0; i < ids.length; i++) {
      const r = results[i];
      if (r.status === "success" && (r.result as string).toLowerCase() === owner.toLowerCase()) {
        owned.push(ids[i]);
        if (owned.length === expected) break;
      }
    }

    if (owned.length === expected) break;
  }

  citizenCache = { owner, tokenIds: owned };
  return owned;
}

// --- Metadata cache ---
// Token metadata (name, image, traits) never changes, so cache permanently per session.

const metadataCache = new Map<string, { metadata: CitizenMetadata; imageUrl: string | null }>();

async function fetchMetadata(
  publicClient: PublicClient,
  contractAddress: Address,
  abi: typeof citizensAbi | typeof evadersAbi,
  tokenIds: bigint[]
): Promise<Array<{ metadata: CitizenMetadata; imageUrl: string | null } | null>> {
  const uncachedIndices: number[] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    const key = `${contractAddress}:${tokenIds[i].toString()}`;
    if (!metadataCache.has(key)) uncachedIndices.push(i);
  }

  if (uncachedIndices.length > 0) {
    const uriResults = (await publicClient.multicall({
      contracts: uncachedIndices.map((idx) => ({
        address: contractAddress,
        abi,
        functionName: "tokenURI" as const,
        args: [tokenIds[idx]]
      })),
      allowFailure: false
    })) as string[];

    const fetched = await Promise.all(
      uriResults.map(async (uri) => {
        try {
          const res = await fetch(toHttpUri(uri));
          if (!res.ok) return null;
          const json = (await res.json()) as CitizenMetadata;
          return { metadata: json, imageUrl: json.image ? toHttpUri(json.image) : null };
        } catch {
          return null;
        }
      })
    );

    for (let j = 0; j < uncachedIndices.length; j++) {
      const result = fetched[j];
      if (result) {
        const key = `${contractAddress}:${tokenIds[uncachedIndices[j]].toString()}`;
        metadataCache.set(key, result);
      }
    }
  }

  return tokenIds.map((id) => {
    const key = `${contractAddress}:${id.toString()}`;
    return metadataCache.get(key) ?? null;
  });
}

// --- Public loaders ---

export async function loadDashboardRows(
  publicClient: PublicClient,
  owner: Address,
  numEpochsToPay: number
): Promise<CitizenDashboardRow[]> {
  const tokenIds = await findOwnedTokenIds(publicClient, owner);

  if (tokenIds.length === 0) {
    return [];
  }

  const [dueResults, auditDueResults, lastEpochResults, metadataList] = await Promise.all([
    publicClient.multicall({
      contracts: tokenIds.map((tokenId) => ({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "estimateTaxesToPay" as const,
        args: [tokenId, numEpochsToPay]
      })),
      allowFailure: false
    }),
    publicClient.multicall({
      contracts: tokenIds.map((tokenId) => ({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "auditDueTimestamp" as const,
        args: [tokenId]
      })),
      allowFailure: false
    }),
    publicClient.multicall({
      contracts: tokenIds.map((tokenId) => ({
        address: GAME_ADDRESS,
        abi: gameAbi,
        functionName: "lastEpochPaid" as const,
        args: [tokenId]
      })),
      allowFailure: false
    }),
    fetchMetadata(publicClient, CITIZENS_ADDRESS, citizensAbi, tokenIds)
  ]);

  return tokenIds.map((tokenId, index) => {
    const dueWei = (dueResults[index] as bigint) ?? 0n;
    const meta = metadataList[index];

    return {
      tokenId,
      dueWei,
      dueEth: formatEther(dueWei),
      auditDueTimestamp: (auditDueResults[index] as bigint) ?? 0n,
      lastEpochPaid: (lastEpochResults[index] as bigint) ?? 0n,
      metadata: meta?.metadata ?? null,
      imageUrl: meta?.imageUrl ?? null
    };
  });
}

export async function loadEvaderRows(publicClient: PublicClient, owner: Address): Promise<EvaderDashboardRow[]> {
  const balance = (await publicClient.readContract({
    address: EVADERS_ADDRESS,
    abi: evadersAbi,
    functionName: "balanceOf",
    args: [owner]
  })) as bigint;

  if (balance === 0n) {
    return [];
  }

  const tokenIds = (await publicClient.multicall({
    contracts: Array.from({ length: Number(balance) }, (_, index) => ({
      address: EVADERS_ADDRESS,
      abi: evadersAbi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [owner, BigInt(index)] as const
    })),
    allowFailure: false
  })) as bigint[];

  const metadataList = await fetchMetadata(publicClient, EVADERS_ADDRESS, evadersAbi, tokenIds);

  return tokenIds.map((tokenId, index) => ({
    tokenId,
    metadata: metadataList[index]?.metadata ?? null,
    imageUrl: metadataList[index]?.imageUrl ?? null
  }));
}
