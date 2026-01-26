/**
 * Engle-Granger Two-Step Cointegration Test
 *
 * Step 1: Estimate the cointegrating regression Y = α + βX + u
 * Step 2: Test residuals for stationarity using ADF
 *
 * If residuals are stationary (I(0)), the series are cointegrated.
 *
 * Note: Critical values for the ADF on residuals differ from standard ADF
 * because the residuals are estimated, not observed.
 *
 * Reference: Engle & Granger (1987), MacKinnon (1991)
 */

import { adfTest, testIntegrationOrder } from "./adf";
import type { EngleGrangerResult, ADFResult } from "@/types/arbitrage";

/**
 * MacKinnon (1991) critical values for cointegration test
 * These are more conservative than standard ADF critical values
 * Format: { num_variables: { significance_level: value } }
 */
const COINTEGRATION_CRITICAL_VALUES: Record<number, { "1%": number; "5%": number; "10%": number }> = {
  // 2 variables (pair)
  2: {
    "1%": -3.90,
    "5%": -3.34,
    "10%": -3.04,
  },
  // 3 variables
  3: {
    "1%": -4.29,
    "5%": -3.74,
    "10%": -3.45,
  },
  // 4 variables
  4: {
    "1%": -4.64,
    "5%": -4.10,
    "10%": -3.81,
  },
};

/**
 * Calculate mean
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Simple OLS regression: Y = α + βX
 * Returns alpha (intercept), beta (slope), and residuals
 */
function olsRegression(
  y: number[],
  x: number[]
): {
  alpha: number;
  beta: number;
  residuals: number[];
  rSquared: number;
} {
  const n = y.length;
  if (n < 3 || x.length !== n) {
    return { alpha: 0, beta: 1, residuals: [], rSquared: 0 };
  }

  const meanX = mean(x);
  const meanY = mean(y);

  // Calculate beta (slope) = Cov(X,Y) / Var(X)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (y[i] - meanY);
    denominator += Math.pow(x[i] - meanX, 2);
  }

  const beta = denominator !== 0 ? numerator / denominator : 1;
  const alpha = meanY - beta * meanX;

  // Calculate residuals
  const residuals: number[] = [];
  let ssRes = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const predicted = alpha + beta * x[i];
    const residual = y[i] - predicted;
    residuals.push(residual);
    ssRes += residual * residual;
    ssTot += Math.pow(y[i] - meanY, 2);
  }

  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { alpha, beta, residuals, rSquared };
}

/**
 * Approximate p-value for cointegration test
 * Uses more conservative critical values than standard ADF
 */
function approximateCointegrationPValue(
  tStat: number,
  numVariables: number
): number {
  const cv = COINTEGRATION_CRITICAL_VALUES[numVariables] || COINTEGRATION_CRITICAL_VALUES[2];

  if (tStat <= cv["1%"]) {
    return 0.001 + (tStat - cv["1%"]) * 0.001;
  } else if (tStat <= cv["5%"]) {
    const range = cv["1%"] - cv["5%"];
    const position = (cv["1%"] - tStat) / range;
    return 0.01 + position * 0.04;
  } else if (tStat <= cv["10%"]) {
    const range = cv["5%"] - cv["10%"];
    const position = (cv["5%"] - tStat) / range;
    return 0.05 + position * 0.05;
  } else if (tStat <= 0) {
    const range = cv["10%"];
    const position = (cv["10%"] - tStat) / Math.abs(range);
    return Math.min(0.5, 0.10 + position * 0.40);
  } else {
    return Math.min(0.99, 0.5 + tStat * 0.1);
  }
}

/**
 * Engle-Granger Cointegration Test
 *
 * Tests if two I(1) series are cointegrated by:
 * 1. Running OLS: Y = α + βX + u
 * 2. Testing residuals u for stationarity
 *
 * @param pricesY - Dependent variable (Y)
 * @param pricesX - Independent variable (X)
 * @param options - Test options
 * @returns Cointegration test result
 */
export function engleGrangerTest(
  pricesY: number[],
  pricesX: number[],
  options: {
    checkIntegration?: boolean;
    maxLag?: number;
  } = {}
): EngleGrangerResult {
  const { checkIntegration = false, maxLag } = options;

  // Default result for invalid input
  const defaultResult: EngleGrangerResult = {
    method: "engle-granger",
    statistic: 0,
    pValue: 1,
    isCointegrated: false,
    hedgeRatio: 1,
    intercept: 0,
    residualADF: {
      statistic: 0,
      pValue: 1,
      criticalValues: COINTEGRATION_CRITICAL_VALUES[2],
      isStationary: false,
      nLags: 0,
      regression: "c",
    },
    residuals: [],
    criticalValues: COINTEGRATION_CRITICAL_VALUES[2],
  };

  // Validate input
  if (pricesY.length !== pricesX.length) {
    console.warn("Engle-Granger: Series must have same length");
    return defaultResult;
  }

  if (pricesY.length < 20) {
    console.warn("Engle-Granger: Need at least 20 observations");
    return defaultResult;
  }

  // Optional: Check that both series are I(1)
  if (checkIntegration) {
    const yIntegration = testIntegrationOrder(pricesY);
    const xIntegration = testIntegrationOrder(pricesX);

    if (!yIntegration.isI1) {
      console.warn("Engle-Granger: Y series is not I(1)");
    }
    if (!xIntegration.isI1) {
      console.warn("Engle-Granger: X series is not I(1)");
    }
  }

  // Step 1: Run cointegrating regression
  const { alpha, beta, residuals, rSquared } = olsRegression(pricesY, pricesX);

  if (residuals.length === 0) {
    return defaultResult;
  }

  // Step 2: Run ADF test on residuals
  // Use "n" (no constant) because residuals have mean ~0 by construction
  const residualADF = adfTest(residuals, {
    maxLag,
    regression: "n", // No constant for residual test
    autolag: "aic",
  });

  // Use cointegration-specific critical values
  const criticalValues = COINTEGRATION_CRITICAL_VALUES[2];

  // Determine if cointegrated using cointegration critical values
  const isCointegrated = residualADF.statistic < criticalValues["5%"];

  // DEBUG: Log values to understand what's happening
  console.log("[Engle-Granger Debug]", {
    adfStat: residualADF.statistic,
    cv5pct: criticalValues["5%"],
    comparison: `${residualADF.statistic} < ${criticalValues["5%"]}`,
    result: isCointegrated,
    residualsLength: residuals.length,
  });

  // Calculate p-value using cointegration distribution
  const pValue = approximateCointegrationPValue(residualADF.statistic, 2);

  return {
    method: "engle-granger",
    statistic: residualADF.statistic,
    pValue: Math.max(0, Math.min(1, pValue)),
    isCointegrated,
    hedgeRatio: beta,
    intercept: alpha,
    residualADF: {
      ...residualADF,
      criticalValues, // Override with cointegration critical values
    },
    residuals,
    criticalValues,
  };
}

/**
 * Build spread from two price series using Engle-Granger hedge ratio
 *
 * Spread_t = Y_t - α - β * X_t
 *
 * @param pricesY - Y series (typically the more volatile asset)
 * @param pricesX - X series (typically the less volatile asset)
 * @param hedgeRatio - β from cointegrating regression
 * @param intercept - α from cointegrating regression
 * @returns Spread series
 */
export function buildSpread(
  pricesY: number[],
  pricesX: number[],
  hedgeRatio: number,
  intercept: number = 0
): number[] {
  if (pricesY.length !== pricesX.length) {
    return [];
  }

  return pricesY.map((y, i) => y - intercept - hedgeRatio * pricesX[i]);
}

/**
 * Calculate Z-Score of spread
 *
 * Z_t = (Spread_t - μ) / σ
 *
 * @param spread - Spread series
 * @param lookback - Optional lookback window for rolling mean/std
 * @returns Z-Score series
 */
export function calculateSpreadZScore(
  spread: number[],
  lookback?: number
): {
  zScore: number[];
  currentZScore: number;
  meanSpread: number;
  stdSpread: number;
} {
  if (spread.length < 2) {
    return {
      zScore: [],
      currentZScore: 0,
      meanSpread: 0,
      stdSpread: 1,
    };
  }

  if (lookback && lookback < spread.length) {
    // Rolling Z-Score
    const zScore: number[] = [];

    for (let i = 0; i < spread.length; i++) {
      if (i < lookback - 1) {
        zScore.push(NaN);
        continue;
      }

      const window = spread.slice(i - lookback + 1, i + 1);
      const windowMean = mean(window);
      const windowStd = stdDev(window);

      if (windowStd === 0) {
        zScore.push(0);
      } else {
        zScore.push((spread[i] - windowMean) / windowStd);
      }
    }

    const lastValidIdx = zScore.length - 1;
    const recentWindow = spread.slice(-lookback);

    return {
      zScore,
      currentZScore: zScore[lastValidIdx] || 0,
      meanSpread: mean(recentWindow),
      stdSpread: stdDev(recentWindow),
    };
  } else {
    // Static Z-Score using all data
    const meanSpread = mean(spread);
    const stdSpread = stdDev(spread);

    if (stdSpread === 0) {
      return {
        zScore: spread.map(() => 0),
        currentZScore: 0,
        meanSpread,
        stdSpread: 1,
      };
    }

    const zScore = spread.map(s => (s - meanSpread) / stdSpread);

    return {
      zScore,
      currentZScore: zScore[zScore.length - 1],
      meanSpread,
      stdSpread,
    };
  }
}

/**
 * Generate trading signal from Z-Score
 *
 * @param zScore - Current Z-Score
 * @param entryThreshold - Threshold to enter trade (typically 2)
 * @param exitThreshold - Threshold to exit (typically 0)
 * @returns Trading signal
 */
export function generateSignal(
  zScore: number,
  entryThreshold: number = 2,
  exitThreshold: number = 0
): {
  signal: "long_a_short_b" | "short_a_long_b" | "neutral";
  strength: "strong" | "moderate" | "weak";
} {
  const absZ = Math.abs(zScore);

  // Determine strength
  let strength: "strong" | "moderate" | "weak";
  if (absZ >= 2.5) {
    strength = "strong";
  } else if (absZ >= 1.5) {
    strength = "moderate";
  } else {
    strength = "weak";
  }

  // Determine signal
  if (zScore > entryThreshold) {
    // Spread is above mean → expect it to decrease
    // Short Y (A), Long X (B) with hedge ratio
    return { signal: "short_a_long_b", strength };
  } else if (zScore < -entryThreshold) {
    // Spread is below mean → expect it to increase
    // Long Y (A), Short X (B) with hedge ratio
    return { signal: "long_a_short_b", strength };
  } else {
    return { signal: "neutral", strength };
  }
}

/**
 * Complete cointegration analysis for a pair
 *
 * Combines all steps: test, spread, z-score, signal
 */
export function analyzeCointegration(
  pricesY: number[],
  pricesX: number[],
  options: {
    checkIntegration?: boolean;
    zScoreLookback?: number;
    entryThreshold?: number;
  } = {}
): {
  test: EngleGrangerResult;
  spread: number[];
  zScore: number[];
  currentZScore: number;
  signal: "long_a_short_b" | "short_a_long_b" | "neutral";
  signalStrength: "strong" | "moderate" | "weak";
  meanSpread: number;
  stdSpread: number;
} | null {
  const { checkIntegration = false, zScoreLookback = 20, entryThreshold = 2 } = options;

  // Run cointegration test
  const test = engleGrangerTest(pricesY, pricesX, { checkIntegration });

  if (test.residuals.length === 0) {
    return null;
  }

  // The residuals ARE the spread (Y - α - βX)
  const spread = test.residuals;

  // Calculate Z-Score
  const zScoreResult = calculateSpreadZScore(spread, zScoreLookback);

  // Generate signal
  const { signal, strength } = generateSignal(zScoreResult.currentZScore, entryThreshold);

  return {
    test,
    spread,
    zScore: zScoreResult.zScore,
    currentZScore: zScoreResult.currentZScore,
    signal,
    signalStrength: strength,
    meanSpread: zScoreResult.meanSpread,
    stdSpread: zScoreResult.stdSpread,
  };
}
