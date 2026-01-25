/**
 * Backtest Metrics
 *
 * Performance metrics for backtesting results.
 * Includes Sharpe, Sortino, drawdown, and other risk-adjusted returns.
 */

import type { Trade, BacktestMetrics } from "@/types/arbitrage";

// ============================================================================
// Constants
// ============================================================================

// Assume 252 trading days per year for annualization
const TRADING_DAYS_PER_YEAR = 252;

// Risk-free rate (annualized, as decimal)
const RISK_FREE_RATE = 0.04; // 4%

// ============================================================================
// Basic Statistics
// ============================================================================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squaredDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (arr.length - 1));
}

function downsideDeviation(arr: number[], threshold = 0): number {
  const downside = arr.filter(v => v < threshold).map(v => Math.pow(v - threshold, 2));
  if (downside.length === 0) return 0;
  return Math.sqrt(downside.reduce((sum, v) => sum + v, 0) / arr.length);
}

// ============================================================================
// Return Metrics
// ============================================================================

/**
 * Calculate cumulative return from daily returns
 */
export function calculateCumulativeReturn(dailyReturns: number[]): number {
  return dailyReturns.reduce((cum, r) => cum * (1 + r), 1) - 1;
}

/**
 * Calculate annualized return
 */
export function calculateAnnualizedReturn(totalReturn: number, days: number): number {
  if (days <= 0) return 0;
  return Math.pow(1 + totalReturn, TRADING_DAYS_PER_YEAR / days) - 1;
}

/**
 * Calculate Sharpe Ratio (annualized)
 */
export function calculateSharpe(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const avgDailyReturn = mean(dailyReturns);
  const dailyStd = standardDeviation(dailyReturns);

  if (dailyStd === 0) return avgDailyReturn > 0 ? Infinity : 0;

  const dailyRiskFree = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const dailySharpe = (avgDailyReturn - dailyRiskFree) / dailyStd;

  // Annualize
  return dailySharpe * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * Calculate Sortino Ratio (annualized)
 * Uses only downside deviation
 */
export function calculateSortino(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;

  const avgDailyReturn = mean(dailyReturns);
  const dailyRiskFree = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;
  const downDev = downsideDeviation(dailyReturns, dailyRiskFree);

  if (downDev === 0) return avgDailyReturn > dailyRiskFree ? Infinity : 0;

  const dailySortino = (avgDailyReturn - dailyRiskFree) / downDev;

  // Annualize
  return dailySortino * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// ============================================================================
// Drawdown Analysis
// ============================================================================

/**
 * Calculate equity curve from daily returns
 */
export function calculateEquityCurve(dailyReturns: number[], initialCapital = 1): number[] {
  const equity: number[] = [initialCapital];
  for (const r of dailyReturns) {
    equity.push(equity[equity.length - 1] * (1 + r));
  }
  return equity;
}

/**
 * Calculate drawdown series
 */
export function calculateDrawdownSeries(equity: number[]): number[] {
  const drawdown: number[] = [];
  let peak = equity[0];

  for (const value of equity) {
    if (value > peak) peak = value;
    drawdown.push((peak - value) / peak);
  }

  return drawdown;
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(equity: number[]): number {
  if (equity.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = equity[0];

  for (const value of equity) {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

// ============================================================================
// Trade Analysis
// ============================================================================

/**
 * Calculate win rate from trades
 */
export function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const winners = trades.filter(t => t.pnlNet > 0);
  return winners.length / trades.length;
}

/**
 * Calculate profit factor (gross profit / gross loss)
 */
export function calculateProfitFactor(trades: Trade[]): number {
  const grossProfit = trades
    .filter(t => t.pnlNet > 0)
    .reduce((sum, t) => sum + t.pnlNet, 0);

  const grossLoss = Math.abs(
    trades
      .filter(t => t.pnlNet < 0)
      .reduce((sum, t) => sum + t.pnlNet, 0)
  );

  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return grossProfit / grossLoss;
}

/**
 * Calculate average trade PnL
 */
export function calculateAvgTradePnl(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return mean(trades.map(t => t.pnlNet));
}

/**
 * Calculate average holding period
 */
export function calculateAvgHoldingPeriod(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return mean(trades.map(t => t.holdingPeriod));
}

// ============================================================================
// Main Metrics Calculator
// ============================================================================

/**
 * Calculate all backtest metrics from trades and daily returns
 */
export function calculateBacktestMetrics(
  trades: Trade[],
  dailyReturns: number[]
): BacktestMetrics {
  const equity = calculateEquityCurve(dailyReturns);
  const totalReturn = calculateCumulativeReturn(dailyReturns);
  const annualizedReturn = calculateAnnualizedReturn(totalReturn, dailyReturns.length);

  const winners = trades.filter(t => t.pnlNet > 0);
  const losers = trades.filter(t => t.pnlNet < 0);

  return {
    totalReturn,
    annualizedReturn,
    sharpe: calculateSharpe(dailyReturns),
    sortino: calculateSortino(dailyReturns),
    maxDrawdown: calculateMaxDrawdown(equity),
    winRate: calculateWinRate(trades),
    profitFactor: calculateProfitFactor(trades),
    avgTradePnl: calculateAvgTradePnl(trades),
    avgHoldingPeriod: calculateAvgHoldingPeriod(trades),
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
  };
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: BacktestMetrics): Record<string, string> {
  return {
    "Total Return": `${(metrics.totalReturn * 100).toFixed(2)}%`,
    "Annualized Return": `${(metrics.annualizedReturn * 100).toFixed(2)}%`,
    "Sharpe Ratio": metrics.sharpe.toFixed(2),
    "Sortino Ratio": metrics.sortino.toFixed(2),
    "Max Drawdown": `${(metrics.maxDrawdown * 100).toFixed(2)}%`,
    "Win Rate": `${(metrics.winRate * 100).toFixed(1)}%`,
    "Profit Factor": metrics.profitFactor.toFixed(2),
    "Avg Trade PnL": `${(metrics.avgTradePnl * 100).toFixed(3)}%`,
    "Avg Holding (bars)": metrics.avgHoldingPeriod.toFixed(1),
    "Total Trades": metrics.totalTrades.toString(),
    "Winners": metrics.winningTrades.toString(),
    "Losers": metrics.losingTrades.toString(),
  };
}
