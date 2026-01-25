import { useState, useEffect } from "react";

export interface FundingRateData {
  fundingTime: number;
  fundingRate: number;
  markPrice: number;
}

export interface FundingRateStats {
  symbol: string;
  currentRate: number;
  avg7d: number;
  avg30d: number;
  apy: number;
  volatility: number;
  persistenceDays: number;
  score: number; // 0-5
  lastUpdate: number;
  history: FundingRateData[];
}

export interface FundingRatesResult {
  opportunities: FundingRateStats[];
  loading: boolean;
  error: string | null;
}

interface UseFundingRatesConfig {
  minAPY?: number;
  daysBack?: number;
  onlyPositive?: boolean;
}

/**
 * Hook to analyze funding rates for arbitrage opportunities
 */
export function useFundingRates(
  config: UseFundingRatesConfig = {}
): FundingRatesResult {
  const {
    minAPY = 0,
    daysBack = 30,
    onlyPositive = false,
  } = config;

  const [opportunities, setOpportunities] = useState<FundingRateStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFundingRates() {
      try {
        setLoading(true);
        setError(null);

        // Load symbols
        const symbolsRes = await fetch("/data/futures/symbols.json");
        if (!symbolsRes.ok) throw new Error("Failed to load symbols");
        const symbolsData = await symbolsRes.json();

        // Load funding rates for each symbol
        const stats: FundingRateStats[] = [];

        for (const symbolInfo of symbolsData.symbols) {
          const symbol = symbolInfo.symbol;

          try {
            const fundingRes = await fetch(`/data/futures/funding/${symbol}.json`);
            if (!fundingRes.ok) continue;

            const fundingData = await fundingRes.json();
            const history: FundingRateData[] = fundingData.data.map((d: any) => ({
              fundingTime: d.t,
              fundingRate: d.rate,
              markPrice: d.mark,
            }));

            if (history.length === 0) continue;

            // Calculate stats
            const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;
            const recentHistory = history.filter(h => h.fundingTime >= cutoffTime);

            if (recentHistory.length === 0) continue;

            // Current rate (most recent)
            const currentRate = recentHistory[recentHistory.length - 1].fundingRate;

            // Average rates
            const last7days = history.filter(
              h => h.fundingTime >= Date.now() - 7 * 24 * 60 * 60 * 1000
            );
            const avg7d =
              last7days.reduce((sum, h) => sum + h.fundingRate, 0) /
              last7days.length;

            const last30days = history.filter(
              h => h.fundingTime >= Date.now() - 30 * 24 * 60 * 60 * 1000
            );
            const avg30d =
              last30days.reduce((sum, h) => sum + h.fundingRate, 0) /
              last30days.length;

            // APY: funding rate is paid every 8h, so 3 times per day
            const apy = avg30d * 3 * 365 * 100; // as percentage

            // Volatility: standard deviation of funding rates
            const mean = avg30d;
            const variance =
              last30days.reduce((sum, h) => sum + Math.pow(h.fundingRate - mean, 2), 0) /
              last30days.length;
            const volatility = Math.sqrt(variance);

            // Persistence: how many consecutive days FR was positive
            let persistenceDays = 0;
            for (let i = recentHistory.length - 1; i >= 0; i--) {
              if (recentHistory[i].fundingRate > 0) {
                persistenceDays++;
              } else {
                break;
              }
            }
            persistenceDays = Math.floor(persistenceDays / 3); // 3 funding periods per day

            // Score (0-5): based on APY, consistency, and low volatility
            let score = 0;
            if (apy > 50) score += 2;
            else if (apy > 30) score += 1.5;
            else if (apy > 15) score += 1;
            else if (apy > 5) score += 0.5;

            if (persistenceDays > 14) score += 1.5;
            else if (persistenceDays > 7) score += 1;
            else if (persistenceDays > 3) score += 0.5;

            if (volatility < 0.0001) score += 1.5;
            else if (volatility < 0.0005) score += 1;
            else if (volatility < 0.001) score += 0.5;

            score = Math.min(5, score); // Cap at 5

            // Filter
            if (onlyPositive && apy <= 0) continue;
            if (apy < minAPY) continue;

            stats.push({
              symbol,
              currentRate,
              avg7d,
              avg30d,
              apy,
              volatility,
              persistenceDays,
              score,
              lastUpdate: recentHistory[recentHistory.length - 1].fundingTime,
              history: recentHistory,
            });
          } catch (err) {
            console.warn(`Failed to load funding data for ${symbol}:`, err);
          }
        }

        // Sort by score (highest first)
        stats.sort((a, b) => b.score - a.score);

        setOpportunities(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadFundingRates();
  }, [minAPY, daysBack, onlyPositive]);

  return { opportunities, loading, error };
}
