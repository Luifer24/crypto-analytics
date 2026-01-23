/**
 * Local Pair Scanner Hook
 *
 * Scans cryptocurrency pairs using local data from JSON files.
 * No API calls needed - instant analysis.
 */

import { useMemo, useState, useEffect } from "react";
import {
  engleGrangerTest,
  calculateHalfLife,
  calculateSpreadZScore,
  generateSignal,
} from "@/lib/cointegration";
import type { PairScanResult, ScannerConfig } from "@/types/arbitrage";

// Symbol info from local data
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

// Default scanner configuration
const DEFAULT_CONFIG: ScannerConfig = {
  minCorrelation: 0.5,
  maxPValue: 0.10,
  minHalfLife: 1,
  maxHalfLife: 100,
  lookbackDays: 90,
};

/**
 * Calculate Pearson correlation
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
 * Calculate composite score
 */
function calculateScore(result: Omit<PairScanResult, "score">): number {
  let score = 0;

  if (result.isCointegrated) score += 50;
  score += Math.max(0, (0.10 - result.pValue) * 100);
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

/**
 * Analyze a pair
 */
function analyzePair(
  symbol1: string,
  symbol2: string,
  name1: string,
  name2: string,
  prices1: number[],
  prices2: number[]
): PairScanResult {
  const correlation = calculateCorrelation(prices1, prices2);
  const egResult = engleGrangerTest(prices1, prices2);
  const halfLifeResult = calculateHalfLife(egResult.residuals);
  const zScoreResult = calculateSpreadZScore(egResult.residuals, 20);
  const signalResult = generateSignal(zScoreResult.currentZScore, 2, 0);

  const partialResult: Omit<PairScanResult, "score"> = {
    pair: [symbol1.replace("USDT", "").toLowerCase(), symbol2.replace("USDT", "").toLowerCase()],
    symbols: [symbol1.replace("USDT", ""), symbol2.replace("USDT", "")],
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
 * Hook to scan pairs using local data
 */
export function useLocalPairScanner(config: Partial<ScannerConfig> = {}) {
  const scannerConfig = { ...DEFAULT_CONFIG, ...config };

  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [priceData, setPriceData] = useState<Map<string, number[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);

  // Load symbols and price data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        // Load symbols list
        const symbolsRes = await fetch("/data/symbols.json");
        if (!symbolsRes.ok) {
          throw new Error("Symbols not found. Run: npm run db:update");
        }
        const symbolsData: SymbolsResponse = await symbolsRes.json();
        setSymbols(symbolsData.symbols);

        // Load price data for each symbol
        const newPriceData = new Map<string, number[]>();
        const cutoffTime = Date.now() - scannerConfig.lookbackDays * 24 * 60 * 60 * 1000;

        for (let i = 0; i < symbolsData.symbols.length; i++) {
          const sym = symbolsData.symbols[i];

          try {
            const priceRes = await fetch(`/data/prices/${sym.symbol}.json`);
            if (priceRes.ok) {
              const priceJson: PriceFileResponse = await priceRes.json();
              const prices = priceJson.data
                .filter((p) => p.t >= cutoffTime)
                .map((p) => p.c);

              if (prices.length >= 30) {
                newPriceData.set(sym.symbol, prices);
              }
            }
          } catch {
            console.warn(`Failed to load ${sym.symbol}`);
          }

          setLoadedCount(i + 1);
          setPriceData(new Map(newPriceData));
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    loadData();
  }, [scannerConfig.lookbackDays]);

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

    const results: PairScanResult[] = [];
    const symbolsWithData = Array.from(priceData.keys());

    for (let i = 0; i < symbolsWithData.length; i++) {
      for (let j = i + 1; j < symbolsWithData.length; j++) {
        const sym1 = symbolsWithData[i];
        const sym2 = symbolsWithData[j];
        const prices1 = priceData.get(sym1)!;
        const prices2 = priceData.get(sym2)!;

        const info1 = symbols.find((s) => s.symbol === sym1);
        const info2 = symbols.find((s) => s.symbol === sym2);

        try {
          const result = analyzePair(
            sym1,
            sym2,
            info1?.name || sym1,
            info2?.name || sym2,
            prices1,
            prices2
          );
          results.push(result);
        } catch (error) {
          console.warn(`Error analyzing ${sym1}/${sym2}:`, error);
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
  }, [priceData, symbols, isLoading, hasError, loadedCount]);

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
    progress: scanResults.progress,
    allResults: scanResults.data,
    filteredResults,
    config: scannerConfig,
    dataSource: "local",
  };
}

/**
 * Summary helper
 */
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
  const strongSignals = results.filter((r) => r.signalStrength === "strong" && r.signal !== "neutral");

  return {
    totalPairs: results.length,
    cointegratedPairs: cointegrated.length,
    activeSignals: activeSignals.length,
    strongSignals: strongSignals.length,
    avgScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    topPairs: results.slice(0, 10),
  };
}
