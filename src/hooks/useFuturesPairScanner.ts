/**
 * Futures Pair Scanner Hook (React Query Version)
 *
 * Professional implementation using TanStack Query for automatic caching,
 * deduplication, and state management.
 */

import { useQuery } from "@tanstack/react-query";
import {
  engleGrangerTest,
  calculateHalfLife,
  calculateSpreadZScore,
  generateSignal,
} from "@/lib/cointegration";
import type { PairScanResult } from "@/types/arbitrage";

// ============================================================================
// Types
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
  t: number;
  i: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  qv: number;
}

interface FuturesPriceResponse {
  symbol: string;
  exportedAt: string;
  count: number;
  data: FuturesPricePoint[];
}

interface FundingPoint {
  t: number;
  rate: number;
  mark: number;
}

interface FundingResponse {
  symbol: string;
  exportedAt: string;
  count: number;
  data: FundingPoint[];
}

export interface FuturesPairScanResult extends PairScanResult {
  avgFundingRate1: number;
  avgFundingRate2: number;
  fundingSpread: number;
  fundingArbScore: number;
  dataPoints: number;
}

interface FuturesScannerConfig {
  lookbackDays: number;
  interval: "5m" | "15m" | "1h" | "4h" | "1d";
  minCorrelation: number;
  maxPValue: number;
  minHalfLife: number;
  maxHalfLife: number;
  includeFunding: boolean;
}

const DEFAULT_CONFIG: FuturesScannerConfig = {
  lookbackDays: 90,
  interval: "15m",
  minCorrelation: 0.5,
  maxPValue: 0.10,
  minHalfLife: 1,
  maxHalfLife: 100,
  includeFunding: true,
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateCorrelation(series1: number[], series2: number[]): number {
  const n = series1.length;
  if (n !== series2.length || n < 2) return 0;

  const mean1 = series1.reduce((a, b) => a + b, 0) / n;
  const mean2 = series2.reduce((a, b) => a + b, 0) / n;

  let num = 0,
    den1 = 0,
    den2 = 0;
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

  if (result.isCointegrated) score += 50;
  score += Math.max(0, (0.1 - result.pValue) * 100);
  score += Math.abs(result.correlation) * 20;

  if (result.halfLife >= 5 && result.halfLife <= 30) {
    score += 20;
  } else if (result.halfLife >= 1 && result.halfLife <= 100) {
    score += 10;
  }

  if (result.signal !== "neutral") {
    score += 15;
    if (result.signalStrength === "strong") score += 10;
    else if (result.signalStrength === "moderate") score += 5;
  }

  const absZ = Math.abs(result.currentZScore);
  if (absZ >= 2) score += 10;
  else if (absZ >= 1.5) score += 5;

  if (result.fundingArbScore > 0.5) score += 10;
  else if (result.fundingArbScore > 0.3) score += 5;

  return Math.round(score * 10) / 10;
}

// ============================================================================
// Data Fetching Function
// ============================================================================

async function fetchFuturesScannerData(
  config: FuturesScannerConfig
): Promise<FuturesPairScanResult[]> {
  console.log("[Scanner] Starting futures scan...", config);

  // Load symbols list
  const symbolsRes = await fetch("/data/futures/symbols.json");
  if (!symbolsRes.ok) {
    throw new Error("Futures data not found. Run: npm run db:futures:export");
  }
  const symbolsData: FuturesSymbolsResponse = await symbolsRes.json();

  // Filter symbols that have the requested interval
  const validSymbols = symbolsData.symbols.filter((s) =>
    s.intervals.includes(config.interval)
  );

  console.log(`[Scanner] Found ${validSymbols.length} symbols with ${config.interval} data`);

  // Load price and funding data
  const priceData = new Map<string, number[]>();
  const fundingData = new Map<string, FundingPoint[]>();
  const cutoffTime = Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000;

  let loadedCount = 0;
  for (const sym of validSymbols) {
    try {
      // Load price data
      const priceRes = await fetch(`/data/futures/prices/${sym.symbol}.json`);
      if (priceRes.ok) {
        const priceJson: FuturesPriceResponse = await priceRes.json();
        const prices = priceJson.data
          .filter((p) => p.t >= cutoffTime && p.i === config.interval)
          .map((p) => p.c);

        if (prices.length >= 30) {
          priceData.set(sym.symbol, prices);
        }
      }

      // Load funding data if enabled
      if (config.includeFunding) {
        const fundingRes = await fetch(`/data/futures/funding/${sym.symbol}.json`);
        if (fundingRes.ok) {
          const fundingJson: FundingResponse = await fundingRes.json();
          const funding = fundingJson.data.filter((f) => f.t >= cutoffTime);
          fundingData.set(sym.symbol, funding);
        }
      }

      loadedCount++;
      // Log progress every 10 symbols
      if (loadedCount % 10 === 0 || loadedCount === validSymbols.length) {
        console.log(`[Scanner] Loaded ${loadedCount}/${validSymbols.length} symbols...`);
      }
    } catch (error) {
      console.warn(`[Scanner] Failed to load ${sym.symbol}:`, error);
    }
  }

  console.log(`[Scanner] Loaded price data for ${priceData.size} symbols`);

  // Analyze all pairs
  const results: FuturesPairScanResult[] = [];
  const symbols = Array.from(priceData.keys());
  const totalPairs = (symbols.length * (symbols.length - 1)) / 2;
  console.log(`[Scanner] Analyzing ${totalPairs} pairs...`);

  let analyzedPairs = 0;
  const startTime = Date.now();

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const symbol1 = symbols[i];
      const symbol2 = symbols[j];

      analyzedPairs++;

      // Log progress every 100 pairs
      if (analyzedPairs % 100 === 0 || analyzedPairs === totalPairs) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Scanner] Progress: ${analyzedPairs}/${totalPairs} pairs (${elapsed}s, ${results.length} matches so far)`);
      }

      const prices1 = priceData.get(symbol1)!;
      const prices2 = priceData.get(symbol2)!;

      // Ensure same length
      const minLen = Math.min(prices1.length, prices2.length);
      const p1 = prices1.slice(-minLen);
      const p2 = prices2.slice(-minLen);

      // Calculate metrics
      const correlation = calculateCorrelation(p1, p2);
      if (Math.abs(correlation) < config.minCorrelation) continue;

      const cointegrationResult = engleGrangerTest(p1, p2);
      const halfLifeResult = calculateHalfLife(cointegrationResult.residuals);
      const zScoreResult = calculateSpreadZScore(cointegrationResult.residuals, 20);
      const signalResult = generateSignal(zScoreResult.currentZScore, 2, 0);

      // Funding rate analysis
      const funding1 = fundingData.get(symbol1) || [];
      const funding2 = fundingData.get(symbol2) || [];
      const avgFundingRate1 =
        funding1.length > 0
          ? funding1.reduce((sum, f) => sum + f.rate, 0) / funding1.length
          : 0;
      const avgFundingRate2 =
        funding2.length > 0
          ? funding2.reduce((sum, f) => sum + f.rate, 0) / funding2.length
          : 0;
      const fundingSpread = Math.abs(avgFundingRate1 - avgFundingRate2);
      const fundingArbScore = Math.min(fundingSpread / 0.01, 1);

      const baseResult: Omit<FuturesPairScanResult, "score"> = {
        pair: [symbol1.replace("USDT", "").toLowerCase(), symbol2.replace("USDT", "").toLowerCase()],
        symbols: [symbol1.replace("USDT", ""), symbol2.replace("USDT", "")],
        correlation,
        isCointegrated: cointegrationResult.isCointegrated,
        pValue: cointegrationResult.pValue,
        halfLife: halfLifeResult.halfLife,
        currentZScore: zScoreResult.currentZScore,
        signal: signalResult.signal,
        signalStrength: signalResult.strength,
        hedgeRatio: cointegrationResult.hedgeRatio,
        avgFundingRate1,
        avgFundingRate2,
        fundingSpread,
        fundingArbScore,
        dataPoints: minLen,
      };

      results.push({
        ...baseResult,
        score: calculateScore(baseResult),
      });
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  console.log(`[Scanner] Analysis complete: ${results.length} pairs found`);

  return results;
}

// ============================================================================
// React Query Hook
// ============================================================================

export function useFuturesPairScanner(config: Partial<FuturesScannerConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const query = useQuery({
    queryKey: ["futures-scanner", fullConfig],
    queryFn: () => fetchFuturesScannerData(fullConfig),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  return {
    allResults: query.data || null,
    filteredResults: query.data || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    progress: { loaded: 0, total: 0 }, // Not needed with React Query
    config: fullConfig,
    refetch: query.refetch,
  };
}

// ============================================================================
// Summary Helper
// ============================================================================

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
  const strongSignals = results.filter(
    (r) => r.signalStrength === "strong" && r.signal !== "neutral"
  );
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
