/**
 * Pair Scanner Hook
 *
 * Scans multiple cryptocurrency pairs for cointegration opportunities.
 * Runs Engle-Granger tests on all combinations and ranks by composite score.
 */

import { useQuery, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getCryptoCompareSymbol } from "./useCryptoCompareData";
import {
  engleGrangerTest,
  calculateHalfLife,
  calculateSpreadZScore,
  generateSignal,
} from "@/lib/cointegration";
import type { PairScanResult, ScannerConfig, Signal, SignalStrength } from "@/types/arbitrage";

const CRYPTOCOMPARE_API = "https://min-api.cryptocompare.com/data/v2";

// Default scanner configuration
const DEFAULT_CONFIG: ScannerConfig = {
  minCorrelation: 0.5,
  maxPValue: 0.10,
  minHalfLife: 1,
  maxHalfLife: 100,
  lookbackDays: 90,
};

/**
 * Fetch historical price data for a symbol
 */
async function fetchPriceHistory(symbol: string, days: number): Promise<number[]> {
  const response = await fetch(
    `${CRYPTOCOMPARE_API}/histoday?fsym=${symbol}&tsym=USD&limit=${days}`
  );

  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.Response !== "Success") {
    throw new Error(json.Message || "Failed to fetch data");
  }

  return json.Data.Data.map((item: { close: number }) => item.close);
}

/**
 * Calculate Pearson correlation between two series
 */
function calculateCorrelation(series1: number[], series2: number[]): number {
  const n = series1.length;
  if (n !== series2.length || n < 2) return 0;

  const mean1 = series1.reduce((a, b) => a + b, 0) / n;
  const mean2 = series2.reduce((a, b) => a + b, 0) / n;

  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = series1[i] - mean1;
    const d2 = series2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }

  const den = Math.sqrt(den1 * den2);
  return den === 0 ? 0 : num / den;
}

/**
 * Calculate composite score for ranking pairs
 * Higher score = better trading opportunity
 */
function calculateScore(result: Omit<PairScanResult, "score">): number {
  let score = 0;

  // Cointegration is essential - big bonus
  if (result.isCointegrated) {
    score += 50;
  }

  // Lower p-value is better (more confident cointegration)
  score += Math.max(0, (0.10 - result.pValue) * 100);

  // Higher correlation helps (but not essential)
  score += Math.abs(result.correlation) * 20;

  // Ideal half-life (5-30 days for swing trading)
  if (result.halfLife >= 5 && result.halfLife <= 30) {
    score += 20;
  } else if (result.halfLife >= 1 && result.halfLife <= 100) {
    score += 10;
  }

  // Active signal bonus
  if (result.signal !== "neutral") {
    score += 15;
    if (result.signalStrength === "strong") score += 10;
    else if (result.signalStrength === "moderate") score += 5;
  }

  // Extreme Z-Score bonus (potential entry point)
  const absZ = Math.abs(result.currentZScore);
  if (absZ >= 2) score += 10;
  else if (absZ >= 1.5) score += 5;

  return Math.round(score * 10) / 10;
}

/**
 * Analyze a pair of price series
 */
function analyzePair(
  id1: string,
  id2: string,
  symbol1: string,
  symbol2: string,
  prices1: number[],
  prices2: number[]
): PairScanResult {
  // Calculate correlation
  const correlation = calculateCorrelation(prices1, prices2);

  // Run Engle-Granger test
  const egResult = engleGrangerTest(prices1, prices2);

  // Calculate half-life
  const halfLifeResult = calculateHalfLife(egResult.residuals);

  // Calculate Z-Score
  const zScoreResult = calculateSpreadZScore(egResult.residuals, 20);

  // Generate signal
  const signalResult = generateSignal(zScoreResult.currentZScore, 2, 0);

  const partialResult: Omit<PairScanResult, "score"> = {
    pair: [id1, id2],
    symbols: [symbol1, symbol2],
    correlation,
    isCointegrated: egResult.isCointegrated,
    pValue: egResult.pValue,
    halfLife: halfLifeResult.halfLife,
    currentZScore: zScoreResult.currentZScore,
    signal: signalResult.signal,
    signalStrength: signalResult.strength,
    hedgeRatio: egResult.hedgeRatio,
  };

  return {
    ...partialResult,
    score: calculateScore(partialResult),
  };
}

/**
 * Hook to scan multiple pairs for cointegration
 */
export function usePairScanner(
  coinIds: string[],
  config: Partial<ScannerConfig> = {}
) {
  const scannerConfig = { ...DEFAULT_CONFIG, ...config };

  // Map coin IDs to symbols
  const coinSymbols = useMemo(() => {
    return coinIds
      .map(id => ({
        id,
        symbol: getCryptoCompareSymbol(id),
      }))
      .filter(item => item.symbol !== null) as { id: string; symbol: string }[];
  }, [coinIds]);

  // Fetch price data for all coins in parallel
  const priceQueries = useQueries({
    queries: coinSymbols.map(({ id, symbol }) => ({
      queryKey: ["scannerPrices", id, scannerConfig.lookbackDays],
      queryFn: () => fetchPriceHistory(symbol, scannerConfig.lookbackDays),
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 2 * 60 * 60 * 1000, // 2 hours
      retry: 2,
    })),
  });

  // Combine all data and run analysis
  const scanResults = useMemo(() => {
    // Check if all queries are done
    const allLoaded = priceQueries.every(q => q.isSuccess);
    const anyLoading = priceQueries.some(q => q.isLoading);
    const anyError = priceQueries.some(q => q.isError);

    if (!allLoaded || anyLoading) {
      return {
        isLoading: true,
        isError: false,
        data: null,
        progress: {
          loaded: priceQueries.filter(q => q.isSuccess).length,
          total: priceQueries.length,
        },
      };
    }

    if (anyError) {
      return {
        isLoading: false,
        isError: true,
        data: null,
        progress: {
          loaded: priceQueries.filter(q => q.isSuccess).length,
          total: priceQueries.length,
        },
      };
    }

    // Build price map
    const priceMap = new Map<string, number[]>();
    coinSymbols.forEach((coin, idx) => {
      const data = priceQueries[idx].data;
      if (data && data.length >= 30) {
        priceMap.set(coin.id, data);
      }
    });

    // Generate all pairs and analyze
    const results: PairScanResult[] = [];
    const coinsWithData = Array.from(priceMap.keys());

    for (let i = 0; i < coinsWithData.length; i++) {
      for (let j = i + 1; j < coinsWithData.length; j++) {
        const id1 = coinsWithData[i];
        const id2 = coinsWithData[j];
        const prices1 = priceMap.get(id1)!;
        const prices2 = priceMap.get(id2)!;

        const symbol1 = coinSymbols.find(c => c.id === id1)?.symbol || id1;
        const symbol2 = coinSymbols.find(c => c.id === id2)?.symbol || id2;

        try {
          const result = analyzePair(id1, id2, symbol1, symbol2, prices1, prices2);
          results.push(result);
        } catch (error) {
          console.warn(`Error analyzing pair ${id1}/${id2}:`, error);
        }
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return {
      isLoading: false,
      isError: false,
      data: results,
      progress: {
        loaded: priceQueries.length,
        total: priceQueries.length,
      },
    };
  }, [priceQueries, coinSymbols]);

  // Filter results based on config
  const filteredResults = useMemo(() => {
    if (!scanResults.data) return null;

    return scanResults.data.filter(result => {
      // Correlation filter
      if (Math.abs(result.correlation) < scannerConfig.minCorrelation) {
        return false;
      }

      // P-value filter (only for cointegrated pairs if strict)
      if (result.isCointegrated && result.pValue > scannerConfig.maxPValue) {
        return false;
      }

      // Half-life filter
      if (result.halfLife < scannerConfig.minHalfLife ||
          result.halfLife > scannerConfig.maxHalfLife) {
        return false;
      }

      return true;
    });
  }, [scanResults.data, scannerConfig]);

  return {
    isLoading: scanResults.isLoading,
    isError: scanResults.isError,
    progress: scanResults.progress,
    allResults: scanResults.data,
    filteredResults,
    config: scannerConfig,
  };
}

/**
 * Get summary statistics for scan results
 */
export function getScanSummary(results: PairScanResult[] | null) {
  if (!results || results.length === 0) {
    return {
      totalPairs: 0,
      cointegratedPairs: 0,
      activeSig: 0,
      strongSignals: 0,
      avgScore: 0,
      topPairs: [] as PairScanResult[],
    };
  }

  const cointegrated = results.filter(r => r.isCointegrated);
  const activeSignals = results.filter(r => r.signal !== "neutral");
  const strongSignals = results.filter(r => r.signalStrength === "strong" && r.signal !== "neutral");

  return {
    totalPairs: results.length,
    cointegratedPairs: cointegrated.length,
    activeSignals: activeSignals.length,
    strongSignals: strongSignals.length,
    avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    topPairs: results.slice(0, 10),
  };
}
