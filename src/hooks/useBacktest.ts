/**
 * Backtest Hook
 *
 * React hook for running backtests on pairs trading strategies.
 * Supports both Spot and Futures data sources.
 */

import { useState, useCallback } from "react";
import type { BacktestConfig, BacktestResult } from "@/types/arbitrage";
import { runBacktest, DEFAULT_BACKTEST_CONFIG } from "@/lib/backtest";

// ============================================================================
// Types
// ============================================================================

export type DataSource = "spot" | "futures";

export interface BacktestInput {
  symbol1: string;
  symbol2: string;
  lookbackDays: number;
  dataSource: DataSource;
  interval?: "5m" | "15m" | "1h" | "4h" | "1d";
}

export interface BacktestState {
  isLoading: boolean;
  error: string | null;
  result: BacktestResult | null;
  input: BacktestInput | null;
}

// ============================================================================
// Data Fetching
// ============================================================================

interface SpotPriceData {
  t: number;
  c: number;
}

interface FuturesPriceData {
  t: number;
  i: string;
  c: number;
}

async function fetchSpotPrices(symbol: string, lookbackDays: number): Promise<number[]> {
  const res = await fetch(`/data/prices/${symbol}USDT.json`);
  if (!res.ok) throw new Error(`Failed to fetch spot data for ${symbol}`);

  const data = await res.json();
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  const prices: number[] = data.data
    .filter((p: SpotPriceData) => p.t >= cutoff)
    .map((p: SpotPriceData) => p.c);

  return prices;
}

async function fetchFuturesPrices(
  symbol: string,
  lookbackDays: number,
  interval: string = "15m"
): Promise<{ prices: number[]; timestamps: number[] }> {
  const res = await fetch(`/data/futures/prices/${symbol}USDT.json`);
  if (!res.ok) throw new Error(`Failed to fetch futures data for ${symbol}`);

  const data = await res.json();
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  // Filter by interval and time, then resample to daily for backtest
  const filtered: FuturesPriceData[] = data.data.filter(
    (p: FuturesPriceData) => p.t >= cutoff && p.i === interval
  );

  // Resample to daily (take last close of each day)
  const dailyMap = new Map<string, { price: number; timestamp: number }>();
  for (const p of filtered) {
    const date = new Date(p.t).toISOString().split("T")[0];
    dailyMap.set(date, { price: p.c, timestamp: p.t });
  }

  const sorted = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return {
    prices: sorted.map(([, v]) => v.price),
    timestamps: sorted.map(([, v]) => v.timestamp),
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useBacktest() {
  const [state, setState] = useState<BacktestState>({
    isLoading: false,
    error: null,
    result: null,
    input: null,
  });

  const runBacktestAsync = useCallback(
    async (
      input: BacktestInput,
      config: Partial<BacktestConfig> = {}
    ) => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        input,
      }));

      try {
        let prices1: number[];
        let prices2: number[];

        if (input.dataSource === "futures") {
          const [data1, data2] = await Promise.all([
            fetchFuturesPrices(input.symbol1.toUpperCase(), input.lookbackDays, input.interval),
            fetchFuturesPrices(input.symbol2.toUpperCase(), input.lookbackDays, input.interval),
          ]);

          // Align by taking minimum length
          const minLen = Math.min(data1.prices.length, data2.prices.length);
          prices1 = data1.prices.slice(-minLen);
          prices2 = data2.prices.slice(-minLen);
        } else {
          [prices1, prices2] = await Promise.all([
            fetchSpotPrices(input.symbol1.toUpperCase(), input.lookbackDays),
            fetchSpotPrices(input.symbol2.toUpperCase(), input.lookbackDays),
          ]);

          // Align by taking minimum length
          const minLen = Math.min(prices1.length, prices2.length);
          prices1 = prices1.slice(-minLen);
          prices2 = prices2.slice(-minLen);
        }

        if (prices1.length < 30 || prices2.length < 30) {
          throw new Error("Insufficient data for backtest (need at least 30 data points)");
        }

        // Run backtest
        const result = runBacktest(prices1, prices2, config);

        setState({
          isLoading: false,
          error: null,
          result,
          input,
        });

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          result: null,
        }));
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      result: null,
      input: null,
    });
  }, []);

  return {
    ...state,
    runBacktest: runBacktestAsync,
    reset,
    defaultConfig: DEFAULT_BACKTEST_CONFIG,
  };
}

/**
 * Format trade for display
 */
export function formatTrade(trade: BacktestResult["trades"][0], index: number) {
  return {
    id: index + 1,
    side: trade.side === "long_spread" ? "Long" : "Short",
    entryZ: trade.entryZScore.toFixed(2),
    exitZ: trade.exitZScore.toFixed(2),
    pnl: `${(trade.pnlNet * 100).toFixed(2)}%`,
    pnlClass: trade.pnlNet >= 0 ? "text-green-500" : "text-red-500",
    holdingPeriod: `${trade.holdingPeriod}`,
    exitReason: trade.exitReason.replace("_", " "),
  };
}

/**
 * Calculate cumulative PnL for chart
 */
export function calculateCumulativePnL(trades: BacktestResult["trades"]): number[] {
  const cumPnL: number[] = [0];
  let total = 0;

  for (const trade of trades) {
    total += trade.pnlNet;
    cumPnL.push(total);
  }

  return cumPnL;
}
