/**
 * Manual Debug Test for Backtest Engine
 *
 * Creates super simple synthetic data and traces execution step by step
 */

import { runBacktest } from "./engine";
import { calculatePairTradePnl } from "./execution";

/**
 * Test case: Simple oscillating spread
 *
 * Asset1: oscillates 100 ± 10
 * Asset2: constant 100
 * Spread: oscillates ±10
 *
 * Expected behavior:
 * - When asset1 = 90, Z < -2 → BUY spread (long asset1, short asset2)
 * - When asset1 = 110, spread reverts → EXIT with profit
 */
export function testSimpleOscillation() {
  console.log("\n=== SIMPLE OSCILLATION TEST ===\n");

  // Create oscillating data with enough points (100 bars)
  // Asset1 oscillates smoothly using sine wave
  // Asset2 stays constant at 100
  const prices1: number[] = [];
  const prices2: number[] = [];

  for (let i = 0; i < 100; i++) {
    const oscillation = Math.sin(i / 10) * 10; // Oscillates ±10
    prices1.push(100 + oscillation);
    prices2.push(100); // Constant
  }

  console.log(`Generated ${prices1.length} bars of oscillating data`);
  console.log("Sample prices:");
  [0, 25, 50, 75, 99].forEach(i => {
    console.log(`  Bar ${i}: Asset1=${prices1[i].toFixed(2)}, Asset2=${prices2[i]}, Spread=${(prices1[i] - prices2[i]).toFixed(2)}`);
  });

  // Run backtest with forced parameters (we KNOW the true relationship)
  const result = runBacktest(prices1, prices2, {
    entryThreshold: 1.5,  // Lower threshold to ensure trades
    exitThreshold: 0.0,
    stopLoss: 5.0,
    commissionPct: 0,     // No costs to isolate PnL logic
    slippageBps: 0,
    forceHedgeRatio: 1.0, // Force β = 1 (we know P1 ≈ P2)
    forceIntercept: 0.0,  // Force α = 0 (we know mean = 0)
  });

  console.log("\n=== BACKTEST RESULTS ===");
  console.log(`Total Trades: ${result.trades.length}`);
  console.log(`Win Rate: ${(result.metrics.winRate * 100).toFixed(1)}%`);
  console.log(`Total Return: ${(result.metrics.totalReturn * 100).toFixed(2)}%`);

  console.log("\n=== INDIVIDUAL TRADES ===");
  result.trades.forEach((trade, i) => {
    console.log(`\nTrade ${i + 1}:`);
    console.log(`  Side: ${trade.side}`);
    console.log(`  Entry: bar ${trade.entryTime}, Z=${trade.entryZScore.toFixed(2)}`);
    console.log(`  Exit: bar ${trade.exitTime}, Z=${trade.exitZScore.toFixed(2)}`);
    console.log(`  Entry Prices: Asset1=${trade.entryPrices.asset1}, Asset2=${trade.entryPrices.asset2}`);
    console.log(`  Exit Prices: Asset1=${trade.exitPrices.asset1}, Asset2=${trade.exitPrices.asset2}`);
    console.log(`  PnL: ${(trade.pnlNet * 100).toFixed(2)}%`);
    console.log(`  Reason: ${trade.exitReason}`);

    // Manual PnL calculation for verification
    const manualPnl = calculatePairTradePnl(
      trade.entryPrices.asset1,
      trade.entryPrices.asset2,
      trade.exitPrices.asset1,
      trade.exitPrices.asset2,
      1.0, // Hedge ratio should be ~1 for equal prices
      trade.side === "long_spread"
    );
    console.log(`  Manual PnL: ${(manualPnl * 100).toFixed(2)}%`);
  });

  console.log("\n=== ANALYSIS ===");

  if (result.trades.length === 0) {
    console.log("❌ NO TRADES GENERATED - Entry threshold might be too high");
  } else if (result.metrics.winRate === 0) {
    console.log("❌ ALL TRADES LOST - There's a bug in trade logic or PnL calculation");
  } else if (result.metrics.totalReturn < 0) {
    console.log("⚠️  NEGATIVE RETURN - Unexpected for perfect mean reversion");
  } else {
    console.log("✅ Results look reasonable");
  }

  return result;
}

/**
 * Test PnL calculation in isolation
 */
export function testPnLCalculation() {
  console.log("\n=== PNL CALCULATION TEST ===\n");

  // Test case 1: Long spread, both assets go up equally
  // Should profit 0% (spread unchanged)
  console.log("Test 1: Long spread, both assets +5%");
  const pnl1 = calculatePairTradePnl(100, 100, 105, 105, 1.0, true);
  console.log(`  Expected: ~0%, Got: ${(pnl1 * 100).toFixed(2)}%`);
  console.log(`  ${Math.abs(pnl1) < 0.01 ? "✅ PASS" : "❌ FAIL"}`);

  // Test case 2: Long spread, asset1 outperforms
  // Should profit (spread widened)
  console.log("\nTest 2: Long spread, asset1 +10%, asset2 +5%");
  const pnl2 = calculatePairTradePnl(100, 100, 110, 105, 1.0, true);
  console.log(`  Expected: positive, Got: ${(pnl2 * 100).toFixed(2)}%`);
  console.log(`  ${pnl2 > 0 ? "✅ PASS" : "❌ FAIL"}`);

  // Test case 3: Short spread, asset1 underperforms
  // Should profit (spread narrowed)
  console.log("\nTest 3: Short spread, asset1 -5%, asset2 +0%");
  const pnl3 = calculatePairTradePnl(100, 100, 95, 100, 1.0, false);
  console.log(`  Expected: positive, Got: ${(pnl3 * 100).toFixed(2)}%`);
  console.log(`  ${pnl3 > 0 ? "✅ PASS" : "❌ FAIL"}`);

  // Test case 4: Long spread with high hedge ratio
  // Both assets +5%, with HR=5.0 we have unequal weights:
  // weight1 = 1/(1+5) = 16.7%, weight2 = 5/(1+5) = 83.3%
  // PnL = 16.7% * 5% - 83.3% * 5% = -3.33%
  console.log("\nTest 4: Long spread, HR=5.0, both assets +5%");
  const pnl4 = calculatePairTradePnl(100, 100, 105, 105, 5.0, true);
  const expected4 = -0.0333; // -3.33%
  console.log(`  Expected: ~${(expected4 * 100).toFixed(2)}%, Got: ${(pnl4 * 100).toFixed(2)}%`);
  console.log(`  ${Math.abs(pnl4 - expected4) < 0.001 ? "✅ PASS" : "❌ FAIL"}`);
}

/**
 * Test entry/exit logic
 */
export function testEntryExitLogic() {
  console.log("\n=== ENTRY/EXIT LOGIC TEST ===\n");

  // Scenario: Spread goes from -20 (cheap) to 0 (mean)
  // We should go LONG spread at -20, EXIT at 0, and PROFIT

  const prices1: number[] = [];
  const prices2: number[] = [];

  // Build 60-bar series with clear mean reversion pattern
  // Bars 0-20: Establish baseline at 100
  for (let i = 0; i < 20; i++) {
    prices1.push(100);
    prices2.push(100);
  }

  // Bars 20-30: Asset1 drops to 80 (spread = -20, very cheap)
  for (let i = 0; i < 10; i++) {
    const drop = (i / 10) * 20; // Linear drop from 0 to 20
    prices1.push(100 - drop);
    prices2.push(100);
  }

  // Bars 30-50: Asset1 recovers back to 100 (spread returns to 0)
  for (let i = 0; i < 20; i++) {
    const recovery = (i / 20) * 20; // Linear recovery from -20 to 0
    prices1.push(80 + recovery);
    prices2.push(100);
  }

  console.log(`Generated ${prices1.length} bars`);
  console.log("Scenario: Spread drops from 0 to -20, then reverts to 0");
  console.log("Expected: Enter LONG when spread is cheap, exit when spread returns to mean, PROFIT\n");

  const result = runBacktest(prices1, prices2, {
    entryThreshold: 1.0,
    exitThreshold: 0.0,
    stopLoss: 5.0,
    commissionPct: 0,
    slippageBps: 0,
    forceHedgeRatio: 1.0, // Force β = 1 (we know P1 ≈ P2)
    forceIntercept: 0.0,  // Force α = 0 (we know mean = 0)
  });

  if (result.trades.length === 0) {
    console.log("❌ NO TRADES - Entry logic may be broken");
    return;
  }

  const trade = result.trades[0];
  console.log(`Trade executed:`);
  console.log(`  Side: ${trade.side} (expected: long_spread)`);
  console.log(`  Entry bar: ${trade.entryTime}`);
  console.log(`  Exit bar: ${trade.exitTime}`);
  console.log(`  Entry spread: ${trade.entryPrices.asset1 - trade.entryPrices.asset2}`);
  console.log(`  Exit spread: ${trade.exitPrices.asset1 - trade.exitPrices.asset2}`);
  console.log(`  PnL: ${(trade.pnlNet * 100).toFixed(2)}%`);

  const passed =
    trade.side === "long_spread" &&
    trade.pnlNet > 0 &&
    trade.entryPrices.asset1 < trade.exitPrices.asset1;

  console.log(`\n${passed ? "✅ PASS" : "❌ FAIL"}`);
}

/**
 * Run all diagnostic tests
 */
export function runDiagnostics() {
  testPnLCalculation();
  testEntryExitLogic();
  testSimpleOscillation();
}
