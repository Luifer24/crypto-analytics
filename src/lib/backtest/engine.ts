/**
 * Backtest Engine
 *
 * Simulates pairs trading strategy on historical data.
 * Supports both static (OLS) and dynamic (Kalman) hedge ratios.
 */

import type {
  Trade,
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
} from "@/types/arbitrage";
import {
  engleGrangerTest,
  calculateSpreadZScore,
} from "@/lib/cointegration";
import { KalmanFilter } from "@/lib/filters/kalman";
import { calculateBacktestMetrics } from "./metrics";
import {
  ExecutionCosts,
  BINANCE_FUTURES_COSTS,
  calculatePairTradePnl,
  calculateRoundTripCosts,
} from "./execution";

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  entryThreshold: 2.0,   // Enter when |Z| > 2
  exitThreshold: 0.0,    // Exit when Z crosses 0
  stopLoss: 3.0,         // Stop if |Z| > 3
  commissionPct: 0.0004, // Binance Futures taker
  slippageBps: 3,        // ~3 bps slippage
  useDynamicHedge: false,
  kalmanConfig: {
    delta: 0.0001,
    initialP: 1,
    initialVe: 0.001,
  },
};

// ============================================================================
// Position State
// ============================================================================

interface PositionState {
  isOpen: boolean;
  side: "long_spread" | "short_spread" | null;
  entryBar: number;
  entryZScore: number;
  entryPrice1: number;
  entryPrice2: number;
  hedgeRatio: number;
}

// ============================================================================
// Backtest Engine
// ============================================================================

/**
 * Run backtest for a pairs trading strategy
 *
 * @param prices1 - Price series for asset 1
 * @param prices2 - Price series for asset 2
 * @param config - Backtest configuration
 * @param lookbackForStats - Bars for rolling statistics (Z-Score calculation)
 */
export function runBacktest(
  prices1: number[],
  prices2: number[],
  config: Partial<BacktestConfig> = {},
  lookbackForStats: number = 20
): BacktestResult {
  const cfg = { ...DEFAULT_BACKTEST_CONFIG, ...config };

  // Validate input
  if (prices1.length !== prices2.length) {
    throw new Error("Price series must have the same length");
  }
  if (prices1.length < lookbackForStats + 10) {
    throw new Error("Insufficient data for backtest");
  }

  const n = prices1.length;
  const trades: Trade[] = [];
  const dailyReturns: number[] = [];

  // Execution costs
  const costs: ExecutionCosts = {
    commissionPct: cfg.commissionPct,
    slippageBps: cfg.slippageBps,
  };

  // Initialize position state
  let position: PositionState = {
    isOpen: false,
    side: null,
    entryBar: 0,
    entryZScore: 0,
    entryPrice1: 0,
    entryPrice2: 0,
    hedgeRatio: 0,
  };

  // Calculate initial hedge ratio using first lookback period
  const egResult = engleGrangerTest(
    prices1.slice(0, lookbackForStats),
    prices2.slice(0, lookbackForStats)
  );
  let currentHedgeRatio = egResult.hedgeRatio;

  // Initialize Kalman filter if using dynamic hedge
  let kalman: KalmanFilter | null = null;
  if (cfg.useDynamicHedge && cfg.kalmanConfig) {
    kalman = new KalmanFilter(cfg.kalmanConfig);
    // Warm up Kalman filter
    for (let i = 0; i < Math.min(lookbackForStats, n); i++) {
      kalman.update(prices1[i], prices2[i]);
    }
  }

  // Z-Score history for rolling calculation
  const spreadHistory: number[] = [];

  // Track equity for daily returns
  let previousEquity = 1.0;
  let currentEquity = 1.0;

  // Main simulation loop
  for (let i = lookbackForStats; i < n; i++) {
    const p1 = prices1[i];
    const p2 = prices2[i];

    // Update hedge ratio if using Kalman
    if (kalman && cfg.useDynamicHedge) {
      kalman.update(p1, p2);
      currentHedgeRatio = kalman.getState().beta;
    }

    // Calculate spread: S = P1 - beta * P2
    const spread = p1 - currentHedgeRatio * p2;
    spreadHistory.push(spread);

    // Keep only recent history for Z-Score calculation
    if (spreadHistory.length > lookbackForStats) {
      spreadHistory.shift();
    }

    // Calculate Z-Score
    let zScore = 0;
    if (spreadHistory.length >= lookbackForStats) {
      const zResult = calculateSpreadZScore(spreadHistory, lookbackForStats);
      zScore = zResult.currentZScore;
    }

    // Track unrealized PnL if position is open
    if (position.isOpen) {
      const unrealizedPnl = calculatePairTradePnl(
        position.entryPrice1,
        position.entryPrice2,
        p1,
        p2,
        position.hedgeRatio,
        position.side === "long_spread"
      );

      currentEquity = previousEquity * (1 + unrealizedPnl);
    }

    // Check exit conditions
    if (position.isOpen) {
      let shouldExit = false;
      let exitReason: Trade["exitReason"] = "mean_reversion";

      // Mean reversion exit
      if (position.side === "long_spread" && zScore >= cfg.exitThreshold) {
        shouldExit = true;
        exitReason = "mean_reversion";
      } else if (position.side === "short_spread" && zScore <= cfg.exitThreshold) {
        shouldExit = true;
        exitReason = "mean_reversion";
      }

      // Stop loss exit
      if (!shouldExit && Math.abs(zScore) >= cfg.stopLoss) {
        // Only trigger stop if Z moved further against us
        if (
          (position.side === "long_spread" && zScore < position.entryZScore) ||
          (position.side === "short_spread" && zScore > position.entryZScore)
        ) {
          shouldExit = true;
          exitReason = "stop_loss";
        }
      }

      if (shouldExit) {
        const grossPnl = calculatePairTradePnl(
          position.entryPrice1,
          position.entryPrice2,
          p1,
          p2,
          position.hedgeRatio,
          position.side === "long_spread"
        );

        const roundTripCost = calculateRoundTripCosts(costs);
        const netPnl = grossPnl - roundTripCost;

        trades.push({
          entryTime: position.entryBar,
          exitTime: i,
          side: position.side!,
          entryZScore: position.entryZScore,
          exitZScore: zScore,
          entryPrices: { asset1: position.entryPrice1, asset2: position.entryPrice2 },
          exitPrices: { asset1: p1, asset2: p2 },
          pnl: grossPnl,
          pnlNet: netPnl,
          holdingPeriod: i - position.entryBar,
          exitReason,
        });

        // Update equity
        currentEquity = previousEquity * (1 + netPnl);

        // Reset position
        position = {
          isOpen: false,
          side: null,
          entryBar: 0,
          entryZScore: 0,
          entryPrice1: 0,
          entryPrice2: 0,
          hedgeRatio: 0,
        };
      }
    }

    // Check entry conditions (only if not in position)
    if (!position.isOpen && spreadHistory.length >= lookbackForStats) {
      // Long spread entry: Z < -threshold (spread is cheap)
      if (zScore < -cfg.entryThreshold) {
        position = {
          isOpen: true,
          side: "long_spread",
          entryBar: i,
          entryZScore: zScore,
          entryPrice1: p1,
          entryPrice2: p2,
          hedgeRatio: currentHedgeRatio,
        };
        // Don't reset previousEquity here - let it update at end of bar
      }
      // Short spread entry: Z > threshold (spread is expensive)
      else if (zScore > cfg.entryThreshold) {
        position = {
          isOpen: true,
          side: "short_spread",
          entryBar: i,
          entryZScore: zScore,
          entryPrice1: p1,
          entryPrice2: p2,
          hedgeRatio: currentHedgeRatio,
        };
        // Don't reset previousEquity here - let it update at end of bar
      }
    }

    // Calculate bar return (return for this time period)
    // This is used for Sharpe ratio and other metrics
    const barReturn = previousEquity > 0 ? (currentEquity / previousEquity) - 1 : 0;
    dailyReturns.push(barReturn);

    // Update baseline equity for next bar
    previousEquity = currentEquity;
  }

  // Close any open position at end of data
  if (position.isOpen) {
    const finalP1 = prices1[n - 1];
    const finalP2 = prices2[n - 1];

    const grossPnl = calculatePairTradePnl(
      position.entryPrice1,
      position.entryPrice2,
      finalP1,
      finalP2,
      position.hedgeRatio,
      position.side === "long_spread"
    );

    const roundTripCost = calculateRoundTripCosts(costs);
    const netPnl = grossPnl - roundTripCost;

    trades.push({
      entryTime: position.entryBar,
      exitTime: n - 1,
      side: position.side!,
      entryZScore: position.entryZScore,
      exitZScore: 0,
      entryPrices: { asset1: position.entryPrice1, asset2: position.entryPrice2 },
      exitPrices: { asset1: finalP1, asset2: finalP2 },
      pnl: grossPnl,
      pnlNet: netPnl,
      holdingPeriod: n - 1 - position.entryBar,
      exitReason: "end_of_data",
    });
  }

  // Build equity curve
  const equity = [1];
  for (const r of dailyReturns) {
    equity.push(equity[equity.length - 1] * (1 + r));
  }

  // Calculate metrics
  const metrics = calculateBacktestMetrics(trades, dailyReturns);

  return {
    trades,
    equity,
    metrics,
    dailyReturns,
    config: cfg,
  };
}

/**
 * Run backtest with timestamps
 * Returns results with actual timestamps instead of bar indices
 */
export function runBacktestWithTimestamps(
  prices1: number[],
  prices2: number[],
  timestamps: number[],
  config: Partial<BacktestConfig> = {},
  lookbackForStats: number = 20
): BacktestResult & { timestampedTrades: Array<Trade & { entryTimestamp: number; exitTimestamp: number }> } {
  const result = runBacktest(prices1, prices2, config, lookbackForStats);

  const timestampedTrades = result.trades.map(trade => ({
    ...trade,
    entryTimestamp: timestamps[trade.entryTime] || trade.entryTime,
    exitTimestamp: timestamps[trade.exitTime] || trade.exitTime,
  }));

  return {
    ...result,
    timestampedTrades,
  };
}

/**
 * Run parameter optimization
 * Tests multiple configurations and returns the best
 */
export function optimizeParameters(
  prices1: number[],
  prices2: number[],
  parameterGrid: {
    entryThresholds: number[];
    exitThresholds: number[];
    stopLosses: number[];
  },
  baseConfig: Partial<BacktestConfig> = {}
): {
  bestConfig: BacktestConfig;
  bestMetrics: BacktestMetrics;
  allResults: Array<{ config: BacktestConfig; metrics: BacktestMetrics }>;
} {
  const allResults: Array<{ config: BacktestConfig; metrics: BacktestMetrics }> = [];

  for (const entry of parameterGrid.entryThresholds) {
    for (const exit of parameterGrid.exitThresholds) {
      for (const stop of parameterGrid.stopLosses) {
        const config: Partial<BacktestConfig> = {
          ...baseConfig,
          entryThreshold: entry,
          exitThreshold: exit,
          stopLoss: stop,
        };

        try {
          const result = runBacktest(prices1, prices2, config);
          allResults.push({
            config: result.config,
            metrics: result.metrics,
          });
        } catch {
          // Skip invalid configurations
        }
      }
    }
  }

  // Find best by Sharpe ratio
  allResults.sort((a, b) => b.metrics.sharpe - a.metrics.sharpe);

  return {
    bestConfig: allResults[0]?.config || DEFAULT_BACKTEST_CONFIG,
    bestMetrics: allResults[0]?.metrics || ({} as BacktestMetrics),
    allResults,
  };
}
