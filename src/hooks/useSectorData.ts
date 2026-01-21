import { useMemo } from "react";
import { useCryptoCompareList } from "./useCryptoCompareList";
import {
  SECTORS,
  COIN_SECTOR_MAP,
  getCoinSector,
  getSectorById,
  type Sector,
} from "@/data/sectors";
import type { CryptoAsset } from "@/types/crypto";

export interface SectorPerformance extends Sector {
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChange7d: number;
  coinCount: number;
  topCoins: CryptoAsset[];
}

export interface SectorData {
  sectors: SectorPerformance[];
  isLoading: boolean;
  error: Error | null;
}

// Calculate weighted average based on market cap
const calculateWeightedChange = (
  coins: CryptoAsset[],
  field: "price_change_percentage_24h" | "price_change_percentage_7d_in_currency"
): number => {
  const totalMarketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
  if (totalMarketCap === 0) return 0;

  const weightedSum = coins.reduce((sum, coin) => {
    const change = coin[field] || 0;
    const weight = (coin.market_cap || 0) / totalMarketCap;
    return sum + change * weight;
  }, 0);

  return weightedSum;
};

// Hook to get sector performance data
export const useSectorPerformance = (limit: number = 100): SectorData => {
  const { data: cryptoList, isLoading, error } = useCryptoCompareList(limit);

  const sectors = useMemo(() => {
    if (!cryptoList) return [];

    // Group coins by sector
    const sectorCoins: Record<string, CryptoAsset[]> = {};

    cryptoList.forEach((coin) => {
      const sectorId = getCoinSector(coin.id);
      if (sectorId) {
        if (!sectorCoins[sectorId]) {
          sectorCoins[sectorId] = [];
        }
        sectorCoins[sectorId].push(coin);
      }
    });

    // Calculate performance for each sector
    return SECTORS.map((sector): SectorPerformance => {
      const coins = sectorCoins[sector.id] || [];

      const marketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
      const volume24h = coins.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);

      const priceChange24h = calculateWeightedChange(coins, "price_change_percentage_24h");
      const priceChange7d = calculateWeightedChange(coins, "price_change_percentage_7d_in_currency");

      // Sort by market cap and take top 3
      const topCoins = [...coins]
        .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))
        .slice(0, 3);

      return {
        ...sector,
        marketCap,
        volume24h,
        priceChange24h,
        priceChange7d,
        coinCount: coins.length,
        topCoins,
      };
    })
      .filter((s) => s.coinCount > 0) // Only sectors with coins
      .sort((a, b) => b.marketCap - a.marketCap); // Sort by market cap
  }, [cryptoList]);

  return {
    sectors,
    isLoading,
    error: error as Error | null,
  };
};

// Hook to get coins filtered by sector
export const useCoinsBySector = (sectorId: string | null, limit: number = 100) => {
  const { data: cryptoList, isLoading, error } = useCryptoCompareList(limit);

  const filteredCoins = useMemo(() => {
    if (!cryptoList) return [];
    if (!sectorId || sectorId === "all") return cryptoList;

    return cryptoList.filter((coin) => {
      const coinSector = getCoinSector(coin.id);
      return coinSector === sectorId;
    });
  }, [cryptoList, sectorId]);

  const sectorInfo = sectorId ? getSectorById(sectorId) : null;

  return {
    coins: filteredCoins,
    sectorInfo,
    isLoading,
    error: error as Error | null,
  };
};

// Get all sectors for dropdown
export const useAllSectors = () => {
  return SECTORS;
};

// Helper to format market cap
export const formatMarketCap = (value: number): string => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
};

// Helper to format volume
export const formatVolume = (value: number): string => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};
