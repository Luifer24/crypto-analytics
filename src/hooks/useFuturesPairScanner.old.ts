/**
 * Futures Pair Scanner Hook
 *
 * Scans cryptocurrency pairs using local Futures data (15m candles + funding rates).
 * Includes funding rate analysis for cash-and-carry arbitrage opportunities.
 */

import { useMemo, useState, useEffect } from "react";
import {
  engleGrangerTest,
  calculateHalfLife,
  calculateSpreadZScore,
  generateSignal,
} from "@/lib/cointegration";
import type { PairScanResult, Signal, ScannerConfig } from "@/types/arbitrage";

// ============================================================================
// Types for Futures Data
// ============================================================================

interface FuturesSymbolInfo {
  symbol: string;
  baseAsset: string;
  intervals: string[];
  priceDataPoints: number;
  fundingDataPoints: number;
  firstDate: string | null;
  lastDate: string | null;
}

interface FuturesSymbolsResponse {
  exportedAt: string;
  count: number;
  symbols: FuturesSymbolInfo[];
}

interface FuturesPricePoint {
  t: number;  // timestamp
  i: string;  // interval
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  qv: number; // quote volume
}

interface FuturesPriceResponse {
  symbol: string;
  exportedAt: string;
  count: number;
  data: FuturesPricePoint[];
}

interface FundingPoint {
  t: number;     // timestamp
  rate: number;  // funding rate
  mark: number;  // mark price
}

interface FundingResponse {
  symbol: string;
  exportedAt: string;
  count: number;
  data: FundingPoint[];
}

// Extended result with funding rate info
export interface FuturesPairScanResult extends PairScanResult {
  avgFundingRate1: number;
  avgFundingRate2: number;
  fundingSpread: number;
  fundingArbScore: number;
  dataPoints: number;
}

// ============================================================================
// Scanner Configuration
// ============================================================================

export interface FuturesScannerConfig extends ScannerConfig {
  interval: "5m" | "15m" | "1h" | "4h" | "1d";
  includeFunding: boolean;
}

const DEFAULT_CONFIG: FuturesScannerConfig = {
  minCorrelation: 0.5,
  maxPValue: 0.10,
  minHalfLife: 1,
  maxHalfLife: 100,
  lookbackDays: 90,
  interval: "15m",
  includeFunding: true,
};

// ============================================================================
// Utility Functions
// ============================================================================

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

function calculateScore(result: Omit<FuturesPairScanResult, "score">): number {
  let score = 0;

  // Cointegration bonus
  if (result.isCointegrated) score += 50;
  score += Math.max(0, (0.10 - result.pValue) * 100);

  // Correlation
  score += Math.abs(result.correlation) * 20;

  // Half-life (prefer tradeable range)
  if (result.halfLife >= 5 && result.halfLife <= 30) {
    score += 20;
  } else if (result.halfLife >= 1 && result.halfLife <= 100) {
    score += 10;
  }

  // Signal strength
  if (result.signal !== "neutral") {
    score += 15;
    if (result.signalStrength === "strong") score += 10;
    else if (result.signalStrength === "moderate") score += 5;
  }

  // Z-Score extremity
  const absZ = Math.abs(result.currentZScore);
  if (absZ >= 2) score += 10;
  else if (absZ >= 1.5) score += 5;

  // Funding arbitrage bonus
  if (result.fundingArbScore > 0.5) {
    score += result.fundingArbScore * 15;
  }

  return Math.round(score * 10) / 10;
}

// Resample 15m data to daily for cointegration analysis
function resampleToDaily(prices: FuturesPricePoint[], interval: string): number[] {
  if (interval === "1d") {
    return prices.map(p => p.c);
  }

  // Group by day and take last close
  const dailyMap = new Map<string, number>();

  for (const p of prices) {
    const date = new Date(p.t).toISOString().split("T")[0];
    dailyMap.set(date, p.c);
  }

  return Array.from(dailyMap.values());
}

// Calculate average funding rate (annualized %)
function calculateAvgFundingRate(funding: FundingPoint[], days: number): number {
  if (funding.length === 0) return 0;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = funding.filter(f => f.t >= cutoff);

  if (recent.length === 0) return 0;

  const avgRate = recent.reduce((sum, f) => sum + f.rate, 0) / recent.length;
  // Annualize: 3 funding periods per day * 365 days
  return avgRate * 3 * 365 * 100;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useFuturesPairScanner(config: Partial<FuturesScannerConfig> = {}) {
  const scannerConfig = { ...DEFAULT_CONFIG, ...config };

  const [symbols, setSymbols] = useState<FuturesSymbolInfo[]>([]);
  const [priceData, setPriceData] = useState<Map<string, FuturesPricePoint[]>>(new Map());
  const [fundingData, setFundingData] = useState<Map<string, FundingPoint[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load symbols, price data, and funding data
  useEffect(() => {
    const loadData = async () => {
      // Check cache first (prevent re-loading when switching tabs)
      const cacheKey = `scanner-futures-${scannerConfig.lookbackDays}-${scannerConfig.interval}-${scannerConfig.includeFunding}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          const TTL = 10 * 60 * 1000; // 10 minutes

          if (age < TTL) {
            console.log(`[Scanner Cache] Using cached data (age: ${Math.round(age / 1000)}s)`);
            setSymbols(data.symbols);
            setPriceData(new Map(Object.entries(data.priceData)));
            setFundingData(new Map(Object.entries(data.fundingData)));
            setLoadedCount(data.symbols.length);
            setIsLoading(false);
            return; // Skip loading
          } else {
            console.log(`[Scanner Cache] Expired, reloading...`);
            sessionStorage.removeItem(cacheKey);
          }
        }
      } catch (e) {
        console.warn("[Scanner Cache] Failed to read cache:", e);
      }

      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);

      try {
        // Load symbols list
        const symbolsRes = await fetch("/data/futures/symbols.json");
        if (!symbolsRes.ok) {
          throw new Error("Futures data not found. Run: npm run db:futures:export");
        }
        const symbolsData: FuturesSymbolsResponse = await symbolsRes.json();

        // Filter symbols that have the requested interval
        const validSymbols = symbolsData.symbols.filter(s =>
          s.intervals.includes(scannerConfig.interval)
        );
        setSymbols(validSymbols);

        // Load price and funding data
        const newPriceData = new Map<string, FuturesPricePoint[]>();
        const newFundingData = new Map<string, FundingPoint[]>();
        const cutoffTime = Date.now() - scannerConfig.lookbackDays * 24 * 60 * 60 * 1000;

        for (let i = 0; i < validSymbols.length; i++) {
          const sym = validSymbols[i];

          try {
            // Load price data
            const priceRes = await fetch(`/data/futures/prices/${sym.symbol}.json`);
            if (priceRes.ok) {
              const priceJson: FuturesPriceResponse = await priceRes.json();
              const prices = priceJson.data.filter(p =>
                p.t >= cutoffTime && p.i === scannerConfig.interval
              );

              if (prices.length >= 30) {
                newPriceData.set(sym.symbol, prices);
              }
            }

            // Load funding data if enabled
            if (scannerConfig.includeFunding) {
              const fundingRes = await fetch(`/data/futures/funding/${sym.symbol}.json`);
              if (fundingRes.ok) {
                const fundingJson: FundingResponse = await fundingRes.json();
                const funding = fundingJson.data.filter(f => f.t >= cutoffTime);
                newFundingData.set(sym.symbol, funding);
              }
            }
          } catch {
            // Continue with other symbols
          }

          setLoadedCount(i + 1);
          setPriceData(new Map(newPriceData));
          setFundingData(new Map(newFundingData));
        }

        // Save to cache for future tab switches
        try {
          const cacheKey = `scanner-futures-${scannerConfig.lookbackDays}-${scannerConfig.interval}-${scannerConfig.includeFunding}`;
          const cacheData = {
            timestamp: Date.now(),
            data: {
              symbols: validSymbols,
              priceData: Object.fromEntries(newPriceData),
              fundingData: Object.fromEntries(newFundingData),
            },
          };
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log(`[Scanner Cache] Saved to cache`);
        } catch (e) {
          console.warn("[Scanner Cache] Failed to save:", e);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading futures data:", error);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : "Unknown error");
        setIsLoading(false);
      }
    };

    loadData();
  }, [scannerConfig.lookbackDays, scannerConfig.interval, scannerConfig.includeFunding]);

  // Analyze pairs
  const scanResults = useMemo(() => {
    if (priceData.size < 2) {
      return {
        isLoading,
        isError: hasError,
        data: null,
        progress: { loaded: loadedCount, total: symbols.length },
      };
    }

    const results: FuturesPairScanResult[] = [];
    const symbolsWithData = Array.from(priceData.keys());

    for (let i = 0; i < symbolsWithData.length; i++) {
      for (let j = i + 1; j < symbolsWithData.length; j++) {
        const sym1 = symbolsWithData[i];
        const sym2 = symbolsWithData[j];
        const prices1Raw = priceData.get(sym1)!;
        const prices2Raw = priceData.get(sym2)!;

        // Resample to daily for cointegration
        const prices1 = resampleToDaily(prices1Raw, scannerConfig.interval);
        const prices2 = resampleToDaily(prices2Raw, scannerConfig.interval);

        // Align lengths
        const minLen = Math.min(prices1.length, prices2.length);
        if (minLen < 30) continue;

        const aligned1 = prices1.slice(-minLen);
        const aligned2 = prices2.slice(-minLen);

        // Funding rates
        const funding1 = fundingData.get(sym1) || [];
        const funding2 = fundingData.get(sym2) || [];
        const avgFunding1 = calculateAvgFundingRate(funding1, scannerConfig.lookbackDays);
        const avgFunding2 = calculateAvgFundingRate(funding2, scannerConfig.lookbackDays);
        const fundingSpread = avgFunding1 - avgFunding2;

        // Funding arbitrage score (0-1)
        // High when there's a significant funding differential
        const fundingArbScore = Math.min(Math.abs(fundingSpread) / 50, 1);

        try {
          const correlation = calculateCorrelation(aligned1, aligned2);
          const egResult = engleGrangerTest(aligned1, aligned2);
          const halfLifeResult = calculateHalfLife(egResult.residuals);
          const zScoreResult = calculateSpreadZScore(egResult.residuals, 20);
          const signalResult = generateSignal(zScoreResult.currentZScore, 2, 0);

          const partialResult: Omit<FuturesPairScanResult, "score"> = {
            pair: [sym1.replace("USDT", "").toLowerCase(), sym2.replace("USDT", "").toLowerCase()],
            symbols: [sym1.replace("USDT", ""), sym2.replace("USDT", "")],
            correlation,
            isCointegrated: egResult.isCointegrated,
            pValue: egResult.pValue,
            halfLife: halfLifeResult.halfLife,
            currentZScore: zScoreResult.currentZScore,
            signal: signalResult.signal,
            signalStrength: signalResult.strength,
            hedgeRatio: egResult.hedgeRatio,
            avgFundingRate1: avgFunding1,
            avgFundingRate2: avgFunding2,
            fundingSpread,
            fundingArbScore,
            dataPoints: minLen,
          };

          results.push({
            ...partialResult,
            score: calculateScore(partialResult),
          });
        } catch (error) {
          // Skip problematic pairs
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    return {
      isLoading,
      isError: hasError,
      data: results,
      progress: { loaded: loadedCount, total: symbols.length },
    };
  }, [priceData, fundingData, symbols, isLoading, hasError, loadedCount, scannerConfig]);

  // Filter results
  const filteredResults = useMemo(() => {
    if (!scanResults.data) return null;

    return scanResults.data.filter((result) => {
      if (Math.abs(result.correlation) < scannerConfig.minCorrelation) return false;
      if (result.isCointegrated && result.pValue > scannerConfig.maxPValue) return false;
      if (result.halfLife < scannerConfig.minHalfLife || result.halfLife > scannerConfig.maxHalfLife) return false;
      return true;
    });
  }, [scanResults.data, scannerConfig]);

  return {
    isLoading: scanResults.isLoading,
    isError: scanResults.isError,
    errorMessage,
    progress: scanResults.progress,
    allResults: scanResults.data,
    filteredResults,
    config: scannerConfig,
    dataSource: "futures" as const,
    symbolCount: symbols.length,
  };
}

/**
 * Summary helper for futures scanner
 */
export function getFuturesScanSummary(results: FuturesPairScanResult[] | null) {
  if (!results || results.length === 0) {
    return {
      totalPairs: 0,
      cointegratedPairs: 0,
      activeSignals: 0,
      strongSignals: 0,
      avgScore: 0,
      highFundingArb: 0,
      topPairs: [] as FuturesPairScanResult[],
    };
  }

  const cointegrated = results.filter((r) => r.isCointegrated);
  const activeSignals = results.filter((r) => r.signal !== "neutral");
  const strongSignals = results.filter((r) => r.signalStrength === "strong" && r.signal !== "neutral");
  const highFundingArb = results.filter((r) => r.fundingArbScore > 0.3);

  return {
    totalPairs: results.length,
    cointegratedPairs: cointegrated.length,
    activeSignals: activeSignals.length,
    strongSignals: strongSignals.length,
    avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    highFundingArb: highFundingArb.length,
    topPairs: results.slice(0, 10),
  };
}
