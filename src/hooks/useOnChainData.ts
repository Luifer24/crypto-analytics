import { useQuery } from "@tanstack/react-query";

const MEMPOOL_API = "https://mempool.space/api/v1";

export interface MempoolStats {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: [number, number][];
}

export interface MempoolFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface BlockData {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface HashrateData {
  timestamp: number;
  avgHashrate: number;
  avgDifficulty: number;
  pool?: string;
}

export interface DifficultyAdjustment {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}

const fetchMempoolStats = async (): Promise<MempoolStats> => {
  const response = await fetch(`${MEMPOOL_API}/mempool`);
  if (!response.ok) throw new Error("Failed to fetch mempool stats");
  return response.json();
};

const fetchRecommendedFees = async (): Promise<MempoolFees> => {
  const response = await fetch(`${MEMPOOL_API}/fees/recommended`);
  if (!response.ok) throw new Error("Failed to fetch fees");
  return response.json();
};

const fetchRecentBlocks = async (count: number = 15): Promise<BlockData[]> => {
  const response = await fetch(`https://mempool.space/api/blocks`);
  if (!response.ok) throw new Error("Failed to fetch blocks");
  const blocks = await response.json();
  return blocks.slice(0, count);
};

const fetchHashrateHistory = async (): Promise<HashrateData[]> => {
  const response = await fetch(`${MEMPOOL_API}/mining/hashrate/3m`);
  if (!response.ok) throw new Error("Failed to fetch hashrate");
  const data = await response.json();
  return data.hashrates || [];
};

const fetchCurrentHashrate = async (): Promise<{ currentHashrate: number; currentDifficulty: number }> => {
  const response = await fetch(`${MEMPOOL_API}/mining/hashrate/1w`);
  if (!response.ok) throw new Error("Failed to fetch current hashrate");
  const data = await response.json();
  return {
    currentHashrate: data.currentHashrate,
    currentDifficulty: data.currentDifficulty,
  };
};

const fetchDifficultyAdjustment = async (): Promise<DifficultyAdjustment> => {
  const response = await fetch(`${MEMPOOL_API}/difficulty-adjustment`);
  if (!response.ok) throw new Error("Failed to fetch difficulty adjustment");
  return response.json();
};

const fetchMiningPools = async (): Promise<{ pools: { name: string; share: number; blockCount: number }[] }> => {
  const response = await fetch(`${MEMPOOL_API}/mining/pools/1m`);
  if (!response.ok) throw new Error("Failed to fetch mining pools");
  const data = await response.json();
  return {
    pools: data.pools?.map((p: { name: string; share: number; blockCount: number }) => ({
      name: p.name,
      share: p.share * 100,
      blockCount: p.blockCount,
    })) || [],
  };
};

export const useMempoolStats = () => {
  return useQuery({
    queryKey: ["mempoolStats"],
    queryFn: fetchMempoolStats,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
};

export const useRecommendedFees = () => {
  return useQuery({
    queryKey: ["recommendedFees"],
    queryFn: fetchRecommendedFees,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
};

export const useRecentBlocks = (count: number = 15) => {
  return useQuery({
    queryKey: ["recentBlocks", count],
    queryFn: () => fetchRecentBlocks(count),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

export const useHashrateHistory = () => {
  return useQuery({
    queryKey: ["hashrateHistory"],
    queryFn: fetchHashrateHistory,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCurrentHashrate = () => {
  return useQuery({
    queryKey: ["currentHashrate"],
    queryFn: fetchCurrentHashrate,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDifficultyAdjustment = () => {
  return useQuery({
    queryKey: ["difficultyAdjustment"],
    queryFn: fetchDifficultyAdjustment,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
};

export const useMiningPools = () => {
  return useQuery({
    queryKey: ["miningPools"],
    queryFn: fetchMiningPools,
    staleTime: 10 * 60 * 1000,
  });
};
