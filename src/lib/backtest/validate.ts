/**
 * Backtest Validation Utilities
 *
 * Validates mathematical coherence of backtest results
 */

import type { BacktestResult } from "@/types/arbitrage";
import { runBacktest } from "./engine";

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * Validate that equity curve matches total return
 */
export function validateEquityCurve(result: BacktestResult): ValidationResult {
  const finalEquity = result.equity[result.equity.length - 1];
  const expectedEquity = 1.0 + result.metrics.totalReturn;
  const diff = Math.abs(finalEquity - expectedEquity);

  const passed = diff < 0.0001; // Tolerance of 0.01%

  return {
    passed,
    message: passed
      ? "✓ Equity curve matches total return"
      : `✗ Equity mismatch: final=${finalEquity.toFixed(4)}, expected=${expectedEquity.toFixed(4)}`,
    details: { finalEquity, expectedEquity, diff }
  };
}

/**
 * Validate that profit factor is consistent with total return
 */
export function validateProfitFactor(result: BacktestResult): ValidationResult {
  const { profitFactor, totalReturn } = result.metrics;

  // If profit factor > 1.0, return should be positive (or very slightly negative due to costs)
  const passed = profitFactor > 1.0
    ? totalReturn > -0.02  // Allow small negative due to costs
    : totalReturn <= 0;

  return {
    passed,
    message: passed
      ? `✓ Profit factor (${profitFactor.toFixed(2)}) consistent with return (${(totalReturn * 100).toFixed(2)}%)`
      : `✗ Profit factor (${profitFactor.toFixed(2)}) inconsistent with return (${(totalReturn * 100).toFixed(2)}%)`,
    details: { profitFactor, totalReturn }
  };
}

/**
 * Validate that win rate and average trade PnL make sense together
 */
export function validateWinRate(result: BacktestResult): ValidationResult {
  const { winRate, avgTradePnl, profitFactor } = result.metrics;

  // If we win more than 50% and avg trade is positive, profit factor should be > 1
  const avgPositive = avgTradePnl > 0;
  const winMoreThanHalf = winRate > 0.5;

  if (avgPositive && winMoreThanHalf && profitFactor < 1.0) {
    return {
      passed: false,
      message: `✗ Win rate ${(winRate * 100).toFixed(1)}% with avg PnL ${(avgTradePnl * 100).toFixed(3)}% should have profit factor > 1.0`,
      details: { winRate, avgTradePnl, profitFactor }
    };
  }

  return {
    passed: true,
    message: `✓ Win rate (${(winRate * 100).toFixed(1)}%) consistent with metrics`,
    details: { winRate, avgTradePnl, profitFactor }
  };
}

/**
 * Validate that drawdown is within reasonable bounds
 */
export function validateDrawdown(result: BacktestResult): ValidationResult {
  const { maxDrawdown, totalReturn } = result.metrics;

  // Drawdown should be between 0 and 1
  if (maxDrawdown < 0 || maxDrawdown > 1) {
    return {
      passed: false,
      message: `✗ Max drawdown ${(maxDrawdown * 100).toFixed(2)}% is out of bounds [0%, 100%]`,
      details: { maxDrawdown }
    };
  }

  // If total return is -100%, drawdown should be 100%
  if (totalReturn <= -0.99 && maxDrawdown < 0.99) {
    return {
      passed: false,
      message: `✗ Total return is ${(totalReturn * 100).toFixed(2)}% but drawdown is only ${(maxDrawdown * 100).toFixed(2)}%`,
      details: { totalReturn, maxDrawdown }
    };
  }

  return {
    passed: true,
    message: `✓ Max drawdown (${(maxDrawdown * 100).toFixed(2)}%) is within bounds`,
    details: { maxDrawdown, totalReturn }
  };
}

/**
 * Validate individual trades for sanity
 */
export function validateTrades(result: BacktestResult): ValidationResult {
  const { trades } = result;

  // Check for absurd PnL values
  const absurdTrades = trades.filter(t => t.pnlNet < -1.0 || t.pnlNet > 5.0);

  if (absurdTrades.length > 0) {
    return {
      passed: false,
      message: `✗ Found ${absurdTrades.length} trades with absurd PnL (< -100% or > 500%)`,
      details: {
        absurdTrades: absurdTrades.slice(0, 5).map(t => ({
          pnl: (t.pnlNet * 100).toFixed(2) + '%',
          side: t.side,
          holdingPeriod: t.holdingPeriod
        }))
      }
    };
  }

  // Check for negative holding periods
  const negativePeriods = trades.filter(t => t.holdingPeriod < 0);

  if (negativePeriods.length > 0) {
    return {
      passed: false,
      message: `✗ Found ${negativePeriods.length} trades with negative holding periods`,
      details: { negativePeriods: negativePeriods.length }
    };
  }

  return {
    passed: true,
    message: `✓ All ${trades.length} trades have reasonable values`,
    details: { totalTrades: trades.length }
  };
}

/**
 * Validate that equity curve is monotonic or has reasonable drawdowns
 */
export function validateEquityMonotonicity(result: BacktestResult): ValidationResult {
  const { equity } = result;

  let maxSoFar = equity[0];
  let maxDropInOneBar = 0;

  for (let i = 1; i < equity.length; i++) {
    if (equity[i] > maxSoFar) {
      maxSoFar = equity[i];
    }

    const drop = (equity[i - 1] - equity[i]) / equity[i - 1];
    if (drop > maxDropInOneBar) {
      maxDropInOneBar = drop;
    }
  }

  // No single bar should drop more than 20% (unless there's a huge stop loss)
  if (maxDropInOneBar > 0.2) {
    return {
      passed: false,
      message: `✗ Equity dropped ${(maxDropInOneBar * 100).toFixed(2)}% in a single bar`,
      details: { maxDropInOneBar }
    };
  }

  return {
    passed: true,
    message: `✓ Equity curve has reasonable bar-to-bar changes (max drop: ${(maxDropInOneBar * 100).toFixed(2)}%)`,
    details: { maxDropInOneBar }
  };
}

// ============================================================================
// Comprehensive Validation
// ============================================================================

/**
 * Run all validation checks on a backtest result
 */
export function validateBacktestResult(result: BacktestResult): {
  allPassed: boolean;
  results: ValidationResult[];
  summary: string;
} {
  const results: ValidationResult[] = [
    validateEquityCurve(result),
    validateProfitFactor(result),
    validateWinRate(result),
    validateDrawdown(result),
    validateTrades(result),
    validateEquityMonotonicity(result),
  ];

  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;

  const summary = allPassed
    ? `✅ ALL ${results.length} validation checks PASSED`
    : `⚠️  ${passedCount}/${results.length} checks passed`;

  return { allPassed, results, summary };
}

// ============================================================================
// Synthetic Test Cases
// ============================================================================

/**
 * Generate synthetic price series for testing
 */
export function generateSyntheticPrices(type: "mean-reverting" | "trending" | "random", length: number): {
  prices1: number[];
  prices2: number[];
  expectedResult: "profitable" | "unprofitable" | "neutral";
} {
  let prices1: number[] = [];
  let prices2: number[] = [];

  if (type === "mean-reverting") {
    // Create perfectly mean-reverting spread
    for (let i = 0; i < length; i++) {
      const base = 100;
      const oscillation = Math.sin(i / 20) * 10;
      prices1.push(base + oscillation);
      prices2.push(base); // Asset 2 stays constant
    }
    return { prices1, prices2, expectedResult: "profitable" };
  }

  if (type === "trending") {
    // Create diverging assets
    for (let i = 0; i < length; i++) {
      prices1.push(100 + i * 0.1); // Uptrend
      prices2.push(100 + i * 0.05); // Slower uptrend
    }
    return { prices1, prices2, expectedResult: "unprofitable" };
  }

  // Random walk
  let p1 = 100;
  let p2 = 100;
  for (let i = 0; i < length; i++) {
    p1 *= (1 + (Math.random() - 0.5) * 0.02);
    p2 *= (1 + (Math.random() - 0.5) * 0.02);
    prices1.push(p1);
    prices2.push(p2);
  }

  return { prices1, prices2, expectedResult: "neutral" };
}

/**
 * Test backtest with synthetic data
 */
export function testSyntheticCase(type: "mean-reverting" | "trending" | "random"): {
  passed: boolean;
  message: string;
  result: BacktestResult;
} {
  const { prices1, prices2, expectedResult } = generateSyntheticPrices(type, 500);

  // For synthetic tests:
  // - Force hedge ratio = 1.0 and intercept = 0 (we KNOW the true relationship)
  // - Use zero commission to isolate logic bugs
  // - Use daily bars for synthetic tests (simple baseline)
  const result = runBacktest(prices1, prices2, {
    commissionPct: 0,
    slippageBps: 0,
    forceHedgeRatio: 1.0,
    forceIntercept: 0.0,
    barInterval: '1d',
  });

  let passed = false;
  let message = "";

  if (expectedResult === "profitable") {
    passed = result.metrics.totalReturn > 0 && result.metrics.profitFactor > 1.0;
    message = passed
      ? `✓ Mean-reverting case is profitable (${(result.metrics.totalReturn * 100).toFixed(2)}%)`
      : `✗ Mean-reverting case should be profitable, got ${(result.metrics.totalReturn * 100).toFixed(2)}%`;
  } else if (expectedResult === "unprofitable") {
    passed = result.metrics.totalReturn < 0 || result.metrics.profitFactor < 1.0;
    message = passed
      ? `✓ Trending case is unprofitable (${(result.metrics.totalReturn * 100).toFixed(2)}%)`
      : `✗ Trending case should be unprofitable, got ${(result.metrics.totalReturn * 100).toFixed(2)}%`;
  } else {
    // Neutral: just check it doesn't crash
    passed = true;
    message = `✓ Random case completed (${(result.metrics.totalReturn * 100).toFixed(2)}%)`;
  }

  return { passed, message, result };
}

// ============================================================================
// Console Validation Runner
// ============================================================================

/**
 * Run all validation tests and log to console
 */
export function runValidationSuite(): {
  allPassed: boolean;
  summary: string;
} {
  console.log("\n🧪 BACKTEST VALIDATION SUITE\n");
  console.log("=" .repeat(60));

  // Test 1: Mean-reverting case
  console.log("\n📊 Test 1: Perfect Mean Reversion");
  const test1 = testSyntheticCase("mean-reverting");
  console.log(test1.message);
  console.log(`   Trades: ${test1.result.trades.length}, Win Rate: ${(test1.result.metrics.winRate * 100).toFixed(1)}%, PF: ${test1.result.metrics.profitFactor.toFixed(2)}`);

  // Test 2: Trending case
  console.log("\n📊 Test 2: Trending Market");
  const test2 = testSyntheticCase("trending");
  console.log(test2.message);
  console.log(`   Trades: ${test2.result.trades.length}, Win Rate: ${(test2.result.metrics.winRate * 100).toFixed(1)}%, PF: ${test2.result.metrics.profitFactor.toFixed(2)}`);

  // Test 3: Random case
  console.log("\n📊 Test 3: Random Walk");
  const test3 = testSyntheticCase("random");
  console.log(test3.message);
  console.log(`   Trades: ${test3.result.trades.length}, Win Rate: ${(test3.result.metrics.winRate * 100).toFixed(1)}%, PF: ${test3.result.metrics.profitFactor.toFixed(2)}`);

  // Validate each result
  console.log("\n🔍 Validation Checks:");
  console.log("-" .repeat(60));

  const validation1 = validateBacktestResult(test1.result);
  const validation2 = validateBacktestResult(test2.result);
  const validation3 = validateBacktestResult(test3.result);

  console.log("\nMean-Reverting Case:");
  validation1.results.forEach(r => console.log(`  ${r.message}`));

  console.log("\nTrending Case:");
  validation2.results.forEach(r => console.log(`  ${r.message}`));

  console.log("\nRandom Case:");
  validation3.results.forEach(r => console.log(`  ${r.message}`));

  // Summary
  console.log("\n" + "=" .repeat(60));
  const allTestsPassed = test1.passed && test2.passed && test3.passed;
  const allValidationsPassed = validation1.allPassed && validation2.allPassed && validation3.allPassed;
  const allPassed = allTestsPassed && allValidationsPassed;

  const summary = allPassed
    ? "✅ ALL TESTS PASSED - Backtest engine is working correctly"
    : "⚠️  SOME TESTS FAILED - Review results above";

  console.log(summary);
  console.log("=" .repeat(60) + "\n");

  return { allPassed, summary };
}
