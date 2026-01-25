/**
 * Backtest Module
 *
 * Provides backtesting capabilities for pairs trading strategies.
 *
 * Components:
 * - engine: Main backtest simulation
 * - metrics: Performance measurement
 * - execution: Transaction cost modeling
 */

// Engine
export {
  runBacktest,
  runBacktestWithTimestamps,
  optimizeParameters,
  DEFAULT_BACKTEST_CONFIG,
} from "./engine";

// Metrics
export {
  calculateBacktestMetrics,
  calculateSharpe,
  calculateSortino,
  calculateMaxDrawdown,
  calculateEquityCurve,
  calculateDrawdownSeries,
  calculateWinRate,
  calculateProfitFactor,
  formatMetrics,
} from "./metrics";

// Execution
export {
  simulateExecution,
  simulatePairEntry,
  simulatePairExit,
  calculatePairTradePnl,
  calculateRoundTripCosts,
  calculateBreakEvenPnl,
  calculateRequiredWinRate,
  fixedSlippage,
  volumeAdjustedSlippage,
  spreadBasedSlippage,
  BINANCE_FUTURES_COSTS,
  CONSERVATIVE_COSTS,
  type ExecutionCosts,
  type ExecutionResult,
} from "./execution";

// Re-export types
export type {
  Trade,
  BacktestConfig,
  BacktestResult,
  BacktestMetrics,
} from "@/types/arbitrage";
