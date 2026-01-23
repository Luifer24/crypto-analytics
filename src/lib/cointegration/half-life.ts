/**
 * Half-Life of Mean Reversion Calculation
 *
 * The half-life is the expected time for the spread to revert 50% towards its mean.
 * This is crucial for pairs trading as it determines:
 * - Expected holding period
 * - Whether the pair is suitable for trading (too slow = ties up capital)
 *
 * Method: Fit AR(1) model to the spread
 *   Spread_t = φ * Spread_{t-1} + ε_t
 *
 * For mean-reverting process: 0 < φ < 1
 * Half-life = -ln(2) / ln(φ)
 *
 * Alternatively, fit Ornstein-Uhlenbeck process:
 *   dS_t = θ(μ - S_t)dt + σdW_t
 *
 * Where θ is the speed of mean reversion
 * Half-life = ln(2) / θ
 *
 * Reference: Ornstein-Uhlenbeck process, AR(1) models
 */

import type { HalfLifeResult } from "@/types/arbitrage";

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate half-life using AR(1) regression
 *
 * Model: ΔS_t = α + β * S_{t-1} + ε_t
 * where: ΔS_t = S_t - S_{t-1}
 *
 * This is equivalent to:
 * S_t = (1 + β) * S_{t-1} + α + ε_t
 *
 * So φ = 1 + β
 *
 * For mean reversion, β should be negative (so φ < 1)
 * Half-life = -ln(2) / ln(φ) = -ln(2) / ln(1 + β)
 *
 * @param spread - Spread series (should be stationary/mean-reverting)
 * @returns Half-life result
 */
export function calculateHalfLife(spread: number[]): HalfLifeResult {
  const defaultResult: HalfLifeResult = {
    halfLife: Infinity,
    theta: 0,
    rSquared: 0,
    isTradeable: false,
  };

  if (spread.length < 10) {
    console.warn("Half-life calculation requires at least 10 observations");
    return defaultResult;
  }

  // Calculate lagged spread and spread changes
  const n = spread.length - 1;
  const laggedSpread: number[] = [];   // S_{t-1}
  const spreadChanges: number[] = [];   // ΔS_t = S_t - S_{t-1}

  for (let i = 1; i < spread.length; i++) {
    laggedSpread.push(spread[i - 1]);
    spreadChanges.push(spread[i] - spread[i - 1]);
  }

  // Run OLS: ΔS_t = α + β * S_{t-1}
  const meanLag = mean(laggedSpread);
  const meanChange = mean(spreadChanges);

  // Calculate β (slope)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (laggedSpread[i] - meanLag) * (spreadChanges[i] - meanChange);
    denominator += Math.pow(laggedSpread[i] - meanLag, 2);
  }

  if (denominator === 0) {
    return defaultResult;
  }

  const beta = numerator / denominator;
  const alpha = meanChange - beta * meanLag;

  // Calculate R² for quality assessment
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const predicted = alpha + beta * laggedSpread[i];
    ssRes += Math.pow(spreadChanges[i] - predicted, 2);
    ssTot += Math.pow(spreadChanges[i] - meanChange, 2);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // For mean reversion, β must be negative
  // This implies φ = 1 + β < 1
  if (beta >= 0) {
    // Not mean-reverting (random walk or explosive)
    return {
      halfLife: Infinity,
      theta: 0,
      rSquared,
      isTradeable: false,
    };
  }

  // φ = 1 + β
  const phi = 1 + beta;

  // Ensure φ > 0 for valid half-life calculation
  if (phi <= 0 || phi >= 1) {
    return {
      halfLife: phi >= 1 ? Infinity : 0,
      theta: Math.abs(beta), // theta ≈ -beta for OU process
      rSquared,
      isTradeable: false,
    };
  }

  // Half-life = -ln(2) / ln(φ)
  const halfLife = -Math.log(2) / Math.log(phi);

  // Mean reversion speed (theta in OU process)
  // For discrete time with dt=1: theta ≈ -ln(φ) = -ln(1 + β)
  const theta = -Math.log(phi);

  // Tradeable if half-life is reasonable (1-100 days typically)
  const isTradeable = halfLife > 1 && halfLife < 100;

  return {
    halfLife,
    theta,
    rSquared,
    isTradeable,
  };
}

/**
 * Calculate half-life using Ornstein-Uhlenbeck regression
 *
 * Alternative method that directly estimates OU parameters:
 * dS_t = θ(μ - S_t)dt + σdW_t
 *
 * Discretized: S_t - S_{t-1} = θμ - θS_{t-1} + ε_t
 *
 * Regress: ΔS = a + bS_{t-1}
 * Then: θ = -b, μ = a/θ = -a/b
 *
 * @param spread - Spread series
 * @returns OU parameters
 */
export function estimateOUParameters(spread: number[]): {
  mu: number;      // Long-run mean
  theta: number;   // Mean reversion speed
  sigma: number;   // Volatility
  halfLife: number;
  isTradeable: boolean;
} {
  const defaultResult = {
    mu: 0,
    theta: 0,
    sigma: 0,
    halfLife: Infinity,
    isTradeable: false,
  };

  if (spread.length < 10) {
    return defaultResult;
  }

  const n = spread.length - 1;
  const laggedSpread: number[] = [];
  const spreadChanges: number[] = [];

  for (let i = 1; i < spread.length; i++) {
    laggedSpread.push(spread[i - 1]);
    spreadChanges.push(spread[i] - spread[i - 1]);
  }

  // OLS: ΔS = a + b*S_{t-1}
  const meanLag = mean(laggedSpread);
  const meanChange = mean(spreadChanges);

  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumXY += (laggedSpread[i] - meanLag) * (spreadChanges[i] - meanChange);
    sumX2 += Math.pow(laggedSpread[i] - meanLag, 2);
  }

  if (sumX2 === 0) {
    return defaultResult;
  }

  const b = sumXY / sumX2;
  const a = meanChange - b * meanLag;

  // OU parameters
  // theta = -b
  const theta = -b;

  // For mean reversion, theta must be positive
  if (theta <= 0) {
    return {
      mu: mean(spread),
      theta: 0,
      sigma: 0,
      halfLife: Infinity,
      isTradeable: false,
    };
  }

  // mu = a/theta = -a/b
  const mu = -a / b;

  // Estimate sigma from residuals
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = a + b * laggedSpread[i];
    ssRes += Math.pow(spreadChanges[i] - predicted, 2);
  }
  const sigma = Math.sqrt(ssRes / (n - 2));

  // Half-life = ln(2) / theta
  const halfLife = Math.log(2) / theta;

  // Tradeable range
  const isTradeable = halfLife > 1 && halfLife < 100;

  return {
    mu,
    theta,
    sigma,
    halfLife,
    isTradeable,
  };
}

/**
 * Estimate expected holding period for a trade
 *
 * Based on half-life, estimate how long a position is typically held
 * before the spread reverts to mean.
 *
 * @param halfLife - Half-life in periods
 * @param entryZScore - Z-Score at entry
 * @param exitZScore - Target Z-Score for exit (typically 0)
 * @returns Expected holding period in same units as half-life
 */
export function estimateHoldingPeriod(
  halfLife: number,
  entryZScore: number,
  exitZScore: number = 0
): number {
  if (halfLife <= 0 || !isFinite(halfLife)) {
    return Infinity;
  }

  // For OU process, expected time to reach exitZScore from entryZScore
  // E[T] ≈ halfLife * ln(|entryZScore| / |exitZScore|) / ln(2)
  //
  // Simplified: E[T] ≈ halfLife * |entryZScore - exitZScore| / ln(2)
  // This is a rough approximation

  const deviation = Math.abs(entryZScore - exitZScore);

  if (deviation === 0) {
    return 0;
  }

  // Each half-life, spread moves 50% towards mean
  // To go from z to 0, need roughly log2(|z|) half-lives
  const numHalfLives = Math.log(Math.max(1, Math.abs(entryZScore))) / Math.log(2);

  return halfLife * numHalfLives;
}

/**
 * Check if half-life is suitable for different trading frequencies
 */
export function assessTradingFrequency(halfLife: number): {
  frequency: "high_frequency" | "intraday" | "swing" | "position" | "not_tradeable";
  description: string;
  recommendation: string;
} {
  if (!isFinite(halfLife) || halfLife <= 0) {
    return {
      frequency: "not_tradeable",
      description: "No mean reversion detected",
      recommendation: "This pair is not suitable for statistical arbitrage",
    };
  }

  if (halfLife < 1) {
    return {
      frequency: "high_frequency",
      description: "Very fast mean reversion (< 1 day)",
      recommendation: "Suitable for high-frequency or scalping strategies",
    };
  }

  if (halfLife < 5) {
    return {
      frequency: "intraday",
      description: "Fast mean reversion (1-5 days)",
      recommendation: "Suitable for intraday or short-term swing trading",
    };
  }

  if (halfLife < 20) {
    return {
      frequency: "swing",
      description: "Moderate mean reversion (5-20 days)",
      recommendation: "Ideal for swing trading strategies",
    };
  }

  if (halfLife < 100) {
    return {
      frequency: "position",
      description: "Slow mean reversion (20-100 days)",
      recommendation: "Suitable for position trading, requires patience",
    };
  }

  return {
    frequency: "not_tradeable",
    description: "Very slow mean reversion (> 100 days)",
    recommendation: "Half-life too long for practical trading",
  };
}
