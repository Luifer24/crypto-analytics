/**
 * Local Pair Scanner Hook (React Query Version)
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
import type { PairScanResult, ScannerConfig } from "@/types/arbitrage";

// ============================================================================
// Types
// ============================================================================

interface SymbolInfo {
  symbol: string;
  name: string;
  baseAsset: string;
  dataPoints: number;
}

interface SymbolsResponse {
  symbols: SymbolInfo[];
  exportedAt: string;
}

interface PriceData {
  t: number;
  c: number;
}

interface PriceFileResponse {
  symbol: string;
  name: string;
  data: PriceData[];
}

const DEFAULT_CONFIG: ScannerConfig = {
  minCorrelation: 0.5,
  maxPValue: 0.1,
  minHalfLife: 1,
  maxHalfLife: 100,
  lookbackDays: 90,
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

function calculateScore(result: Omit<PairScanResult, "score">): number {
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

  return Math.round(score * 10) / 10;
}

// ============================================================================
// Data Fetching Function
// ============================================================================

async function fetchSpotScannerData(config: ScannerConfig): Promise<PairScanResult[]> {
  console.log("[Scanner] Starting spot scan...", config);

  // Load symbols list
  const symbolsRes = await fetch("/data/symbols.json");
  if (!symbolsRes.ok) {
    throw new Error("Symbols not found. Run: npm run db:update");
  }
  const symbolsData: SymbolsResponse = await symbolsRes.json();

  console.log(`[Scanner] Found ${symbolsData.symbols.length} symbols`);

  // Load price data for each symbol
  const priceData = new Map<string, number[]>();
  const cutoffTime = Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000;

  for (const sym of symbolsData.symbols) {
    try {
      const priceRes = await fetch(`/data/prices/${sym.symbol}.json`);
      if (priceRes.ok) {
        const priceJson: PriceFileResponse = await priceRes.json();
        const prices = priceJson.data
          .filter((p) => p.t >= cutoffTime)
          .map((p) => p.c);

        if (prices.length >= 30) {
          priceData.set(sym.symbol, prices);
        }
      }
    } catch (error) {
      console.warn(`[Scanner] Failed to load ${sym.symbol}:`, error);
    }
  }

  console.log(`[Scanner] Loaded price data for ${priceData.size} symbols`);

  // Analyze all pairs
  const results: PairScanResult[] = [];
  const symbols = Array.from(priceData.keys());

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const symbol1 = symbols[i];
      const symbol2 = symbols[j];

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

      const baseResult: Omit<PairScanResult, "score"> = {
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

export function useLocalPairScanner(config: Partial<ScannerConfig> = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  const query = useQuery({
    queryKey: ["spot-scanner", fullConfig],
    queryFn: () => fetchSpotScannerData(fullConfig),
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

export function getLocalScanSummary(results: PairScanResult[] | null) {
  if (!results || results.length === 0) {
    return {
      totalPairs: 0,
      cointegratedPairs: 0,
      activeSignals: 0,
      strongSignals: 0,
      avgScore: 0,
      topPairs: [] as PairScanResult[],
    };
  }

  const cointegrated = results.filter((r) => r.isCointegrated);
  const activeSignals = results.filter((r) => r.signal !== "neutral");
  const strongSignals = results.filter(
    (r) => r.signalStrength === "strong" && r.signal !== "neutral"
  );

  return {
    totalPairs: results.length,
    cointegratedPairs: cointegrated.length,
    activeSignals: activeSignals.length,
    strongSignals: strongSignals.length,
    avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    topPairs: results.slice(0, 10),
  };
}
