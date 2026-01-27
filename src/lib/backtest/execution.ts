/**
 * Execution Model
 *
 * Models transaction costs, slippage, and order execution for backtesting.
 */

// ============================================================================
// Types
// ============================================================================

export interface ExecutionCosts {
  /** Commission as a percentage (e.g., 0.001 = 0.1%) */
  commissionPct: number;
  /** Slippage in basis points (e.g., 5 = 0.05%) */
  slippageBps: number;
}

export interface ExecutionResult {
  /** Actual fill price after costs */
  fillPrice: number;
  /** Total cost as percentage of trade value */
  totalCostPct: number;
  /** Commission cost */
  commissionCost: number;
  /** Slippage cost */
  slippageCost: number;
}

// ============================================================================
// Default Costs
// ============================================================================

// Binance Futures taker fees
export const BINANCE_FUTURES_COSTS: ExecutionCosts = {
  commissionPct: 0.0004, // 0.04% taker fee
  slippageBps: 3,        // ~3 bps slippage for liquid pairs
};

// More conservative estimates
export const CONSERVATIVE_COSTS: ExecutionCosts = {
  commissionPct: 0.001,  // 0.1% total fees
  slippageBps: 10,       // 10 bps slippage
};

// ============================================================================
// Slippage Models
// ============================================================================

/**
 * Fixed slippage model
 * Simple percentage-based slippage
 */
export function fixedSlippage(price: number, slippageBps: number, isBuy: boolean): number {
  const slippagePct = slippageBps / 10000;
  if (isBuy) {
    return price * (1 + slippagePct);
  } else {
    return price * (1 - slippagePct);
  }
}

/**
 * Volume-adjusted slippage model
 * Higher slippage for larger orders relative to volume
 *
 * @param price - Order price
 * @param orderSize - Order size in base currency
 * @param avgVolume - Average volume for the asset
 * @param baseSlippageBps - Base slippage in bps
 * @param isBuy - Whether this is a buy order
 */
export function volumeAdjustedSlippage(
  price: number,
  orderSize: number,
  avgVolume: number,
  baseSlippageBps: number,
  isBuy: boolean
): number {
  // Market impact scales with sqrt of order size relative to volume
  const orderPctOfVolume = orderSize / avgVolume;
  const impactMultiplier = 1 + Math.sqrt(orderPctOfVolume * 100);
  const adjustedSlippageBps = baseSlippageBps * impactMultiplier;

  return fixedSlippage(price, adjustedSlippageBps, isBuy);
}

/**
 * Spread-based slippage model
 * Uses bid-ask spread for more accurate execution
 */
export function spreadBasedSlippage(
  midPrice: number,
  spreadPct: number,
  isBuy: boolean
): number {
  const halfSpread = spreadPct / 2;
  if (isBuy) {
    return midPrice * (1 + halfSpread);
  } else {
    return midPrice * (1 - halfSpread);
  }
}

// ============================================================================
// Execution Simulator
// ============================================================================

/**
 * Simulate order execution with costs
 */
export function simulateExecution(
  price: number,
  costs: ExecutionCosts,
  isBuy: boolean
): ExecutionResult {
  // Apply slippage
  const priceAfterSlippage = fixedSlippage(price, costs.slippageBps, isBuy);

  // Calculate costs
  const slippageCost = Math.abs(priceAfterSlippage - price) / price;
  const commissionCost = costs.commissionPct;
  const totalCostPct = slippageCost + commissionCost;

  return {
    fillPrice: priceAfterSlippage,
    totalCostPct,
    commissionCost,
    slippageCost,
  };
}

/**
 * Calculate round-trip costs (entry + exit)
 */
export function calculateRoundTripCosts(costs: ExecutionCosts): number {
  // Commission on both entry and exit
  const commissions = costs.commissionPct * 2;

  // Slippage on both entry and exit
  const slippage = (costs.slippageBps / 10000) * 2;

  return commissions + slippage;
}

/**
 * Apply costs to trade PnL
 */
export function applyTradeCosts(
  grossPnlPct: number,
  costs: ExecutionCosts
): number {
  const roundTripCosts = calculateRoundTripCosts(costs);
  return grossPnlPct - roundTripCosts;
}

// ============================================================================
// Break-even Analysis
// ============================================================================

/**
 * Calculate minimum trade profit needed to break even after costs
 */
export function calculateBreakEvenPnl(costs: ExecutionCosts): number {
  return calculateRoundTripCosts(costs);
}

/**
 * Calculate required win rate for profitability given costs
 *
 * @param avgWinPct - Average winning trade percentage
 * @param avgLossPct - Average losing trade percentage (positive number)
 * @param costs - Execution costs
 */
export function calculateRequiredWinRate(
  avgWinPct: number,
  avgLossPct: number,
  costs: ExecutionCosts
): number {
  const roundTripCosts = calculateRoundTripCosts(costs);

  // Net win/loss after costs
  const netWin = avgWinPct - roundTripCosts;
  const netLoss = avgLossPct + roundTripCosts;

  // Required win rate for break-even: netLoss / (netWin + netLoss)
  return netLoss / (netWin + netLoss);
}

// ============================================================================
// Pair Trading Execution
// ============================================================================

/**
 * Simulate pair trade execution (enter both legs simultaneously)
 */
export function simulatePairEntry(
  price1: number,
  price2: number,
  hedgeRatio: number,
  costs: ExecutionCosts,
  isLongSpread: boolean
): {
  fillPrice1: number;
  fillPrice2: number;
  totalCostsPct: number;
} {
  // Long spread = long asset1, short asset2
  // Short spread = short asset1, long asset2
  const leg1IsBuy = isLongSpread;
  const leg2IsBuy = !isLongSpread;

  const exec1 = simulateExecution(price1, costs, leg1IsBuy);
  const exec2 = simulateExecution(price2, costs, leg2IsBuy);

  // Total costs weighted by position sizes
  // Assuming notional is 1 for asset1 and hedgeRatio for asset2
  const weight1 = 1 / (1 + hedgeRatio);
  const weight2 = hedgeRatio / (1 + hedgeRatio);

  const totalCostsPct = exec1.totalCostPct * weight1 + exec2.totalCostPct * weight2;

  return {
    fillPrice1: exec1.fillPrice,
    fillPrice2: exec2.fillPrice,
    totalCostsPct,
  };
}

/**
 * Simulate pair trade exit
 */
export function simulatePairExit(
  price1: number,
  price2: number,
  hedgeRatio: number,
  costs: ExecutionCosts,
  wasLongSpread: boolean
): {
  fillPrice1: number;
  fillPrice2: number;
  totalCostsPct: number;
} {
  // Exit is opposite of entry
  return simulatePairEntry(price1, price2, hedgeRatio, costs, !wasLongSpread);
}

/**
 * Calculate pair trade PnL
 *
 * IMPORTANT: PnL is normalized by position weights to avoid amplification effects.
 * Each leg contributes proportionally to total capital at risk.
 *
 * For example, if hedgeRatio = 5.0:
 * - Asset1 weight: 1/(1+5) = 16.7%
 * - Asset2 weight: 5/(1+5) = 83.3%
 *
 * This prevents small price differences from causing massive PnL swings.
 */
export function calculatePairTradePnl(
  entryPrice1: number,
  entryPrice2: number,
  exitPrice1: number,
  exitPrice2: number,
  hedgeRatio: number,
  isLongSpread: boolean
): number {
  const return1 = (exitPrice1 - entryPrice1) / entryPrice1;
  const return2 = (exitPrice2 - entryPrice2) / entryPrice2;

  // Normalize by position weights (beta-neutral with equal risk contribution)
  const absHedgeRatio = Math.abs(hedgeRatio);
  const weight1 = 1 / (1 + absHedgeRatio);
  const weight2 = absHedgeRatio / (1 + absHedgeRatio);

  // Long spread: profit when spread widens (asset1 outperforms asset2)
  // Short spread: profit when spread narrows (asset2 outperforms asset1)
  if (isLongSpread) {
    return weight1 * return1 - weight2 * return2;
  } else {
    return weight2 * return2 - weight1 * return1;
  }
}
