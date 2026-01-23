/**
 * Cointegration Module
 *
 * Statistical tests and utilities for pairs trading and statistical arbitrage.
 *
 * Exports:
 * - ADF test for stationarity
 * - Engle-Granger cointegration test
 * - Half-life calculation for mean reversion
 */

// ADF Test
export {
  adfTest,
  testIntegrationOrder,
} from "./adf";

// Engle-Granger Test
export {
  engleGrangerTest,
  buildSpread,
  calculateSpreadZScore,
  generateSignal,
  analyzeCointegration,
} from "./engle-granger";

// Half-Life
export {
  calculateHalfLife,
  estimateOUParameters,
  estimateHoldingPeriod,
  assessTradingFrequency,
} from "./half-life";

// Re-export types
export type {
  ADFResult,
  EngleGrangerResult,
  CointegrationTestResult,
  HalfLifeResult,
} from "@/types/arbitrage";
