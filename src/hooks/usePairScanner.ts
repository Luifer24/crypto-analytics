/**
 * Pair Scanner Hook
 *
 * Scans multiple cryptocurrency pairs for cointegration opportunities.
 * Runs Engle-Granger tests on all combinations and ranks by composite score.
 */

import { useMemo, useState, useEffect, useRef } from "react";
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

// Rate limiting: delay between API calls (ms)
const API_DELAY_MS = 200;

/**
 * Fetch historical price data for a symbol with retry
 */
async function fetchPriceHistory(symbol: string, days: number): Promise<number[]> {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${CRYPTOCOMPARE_API}/histoday?fsym=${symbol}&tsym=USD&limit=${days}`
      );

      if (!response.ok) {
        if (response.status === 429 && attempt < maxRetries - 1) {
          // Rate limited - wait and retry
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(`CryptoCompare API error: ${response.status}`);
      }

      const json = await response.json();

      if (json.Response !== "Success") {
        throw new Error(json.Message || "Failed to fetch data");
      }

      return json.Data.Data.map((item: { close: number }) => item.close);
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  throw new Error("Max retries exceeded");
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
 * Uses sequential fetching with delays to avoid rate limiting
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

  // State for sequential loading
  const [priceData, setPriceData] = useState<Map<string, number[]>>(new Map());
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Sequential fetch effect
  useEffect(() => {
    if (coinSymbols.length === 0) {
      setIsLoading(false);
      return;
    }

    // Abort previous fetch if params change
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const fetchAllPrices = async () => {
      setIsLoading(true);
      setHasError(false);
      setPriceData(new Map());
      setLoadedCount(0);

      const newPriceData = new Map<string, number[]>();

      for (let i = 0; i < coinSymbols.length; i++) {
        // Check if aborted
        if (abortRef.current?.signal.aborted) return;

        const { id, symbol } = coinSymbols[i];

        try {
          const prices = await fetchPriceHistory(symbol, scannerConfig.lookbackDays);

          if (abortRef.current?.signal.aborted) return;

          if (prices && prices.length >= 30) {
            newPriceData.set(id, prices);
            setPriceData(new Map(newPriceData));
          }
          setLoadedCount(i + 1);

          // Delay before next request to avoid rate limiting
          if (i < coinSymbols.length - 1) {
            await new Promise(r => setTimeout(r, API_DELAY_MS));
          }
        } catch (error) {
          console.warn(`Error fetching ${symbol}:`, error);
          setLoadedCount(i + 1);
          // Continue with other coins
        }
      }

      if (!abortRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    };

    fetchAllPrices();

    return () => {
      abortRef.current?.abort();
    };
  }, [coinSymbols, scannerConfig.lookbackDays]);

  // Analyze pairs whenever priceData changes (progressive results)
  const scanResults = useMemo(() => {
    if (priceData.size < 2) {
      return {
        isLoading,
        isError: hasError,
        data: null,
        progress: {
          loaded: loadedCount,
          total: coinSymbols.length,
        },
      };
    }

    // Generate all pairs and analyze
    const results: PairScanResult[] = [];
    const coinsWithData = Array.from(priceData.keys());

    for (let i = 0; i < coinsWithData.length; i++) {
      for (let j = i + 1; j < coinsWithData.length; j++) {
        const id1 = coinsWithData[i];
        const id2 = coinsWithData[j];
        const prices1 = priceData.get(id1)!;
        const prices2 = priceData.get(id2)!;

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
      isLoading,
      isError: hasError,
      data: results,
      progress: {
        loaded: loadedCount,
        total: coinSymbols.length,
      },
    };
  }, [priceData, coinSymbols, isLoading, hasError, loadedCount]);

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
