/**
 * Kalman Filter Hook for Dynamic Hedge Ratio
 *
 * Provides reactive Kalman filtering for pairs trading.
 * Compares static OLS hedge ratio with dynamic Kalman estimate.
 */

import { useMemo } from "react";
import { runKalmanFilter, compareStaticVsDynamic } from "@/lib/filters";
import type { KalmanConfig, KalmanFilterResult } from "@/types/arbitrage";

export interface UseKalmanHedgeResult {
  /** Full Kalman filter result */
  kalmanResult: KalmanFilterResult | null;
  /** Current dynamic hedge ratio */
  dynamicBeta: number;
  /** Current dynamic intercept */
  dynamicAlpha: number;
  /** History of beta values */
  betaHistory: number[];
  /** Dynamic spread using Kalman parameters */
  dynamicSpread: number[];
  /** Dynamic Z-Score */
  dynamicZScore: number[];
  /** Current dynamic Z-Score */
  currentDynamicZScore: number;
  /** Comparison metrics */
  comparison: {
    /** Static spread for comparison */
    staticSpread: number[];
    /** Static Z-Score for comparison */
    staticZScore: number[];
    /** Variance reduction percentage (positive = Kalman better) */
    varianceReduction: number;
    /** Mean reversion improvement percentage */
    meanReversionImprovement: number;
    /** Whether Kalman provides significant improvement */
    kalmanIsBetter: boolean;
  } | null;
}

/**
 * Hook for Kalman-filtered dynamic hedge ratio
 *
 * @param pricesY - Dependent variable prices (e.g., BTC)
 * @param pricesX - Independent variable prices (e.g., ETH)
 * @param staticBeta - Static hedge ratio from OLS for comparison
 * @param staticAlpha - Static intercept from OLS for comparison
 * @param config - Optional Kalman filter configuration
 * @returns Kalman filter results and comparison
 */
export function useKalmanHedge(
  pricesY: number[] | null,
  pricesX: number[] | null,
  staticBeta: number = 1,
  staticAlpha: number = 0,
  config: Partial<KalmanConfig> = {}
): UseKalmanHedgeResult {
  // Run Kalman filter
  const kalmanResult = useMemo(() => {
    if (!pricesY || !pricesX || pricesY.length < 30 || pricesX.length !== pricesY.length) {
      return null;
    }

    try {
      return runKalmanFilter(pricesY, pricesX, config);
    } catch (error) {
      console.warn("Kalman filter error:", error);
      return null;
    }
  }, [pricesY, pricesX, config]);

  // Compare static vs dynamic
  const comparison = useMemo(() => {
    if (!pricesY || !pricesX || pricesY.length < 30 || pricesX.length !== pricesY.length) {
      return null;
    }

    try {
      const result = compareStaticVsDynamic(pricesY, pricesX, staticBeta, staticAlpha);

      return {
        staticSpread: result.staticSpread,
        staticZScore: result.staticZScore,
        varianceReduction: result.varianceReduction,
        meanReversionImprovement: result.correlationImprovement,
        kalmanIsBetter: result.varianceReduction > 5 || result.correlationImprovement > 5,
      };
    } catch (error) {
      console.warn("Comparison error:", error);
      return null;
    }
  }, [pricesY, pricesX, staticBeta, staticAlpha]);

  // Extract values from result
  const dynamicBeta = kalmanResult?.currentState.beta ?? staticBeta;
  const dynamicAlpha = kalmanResult?.currentState.alpha ?? staticAlpha;
  const betaHistory = kalmanResult?.betaHistory ?? [];
  const dynamicSpread = kalmanResult?.spreadHistory ?? [];
  const dynamicZScore = kalmanResult?.zScoreHistory ?? [];
  const currentDynamicZScore = kalmanResult?.currentZScore ?? 0;

  return {
    kalmanResult,
    dynamicBeta,
    dynamicAlpha,
    betaHistory,
    dynamicSpread,
    dynamicZScore,
    currentDynamicZScore,
    comparison,
  };
}

/**
 * Get beta stability metrics
 *
 * Analyzes how stable the hedge ratio has been over time.
 * More stable = more reliable for trading.
 */
export function analyzeBetaStability(betaHistory: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
  cv: number; // Coefficient of variation
  isStable: boolean;
  trend: "increasing" | "decreasing" | "stable";
} {
  if (betaHistory.length < 10) {
    return {
      mean: betaHistory[betaHistory.length - 1] ?? 1,
      std: 0,
      min: betaHistory[0] ?? 1,
      max: betaHistory[0] ?? 1,
      range: 0,
      cv: 0,
      isStable: false,
      trend: "stable",
    };
  }

  const validBetas = betaHistory.filter(b => !isNaN(b) && isFinite(b));
  if (validBetas.length < 10) {
    return {
      mean: 1,
      std: 0,
      min: 1,
      max: 1,
      range: 0,
      cv: 0,
      isStable: false,
      trend: "stable",
    };
  }

  const mean = validBetas.reduce((a, b) => a + b, 0) / validBetas.length;
  const variance = validBetas.reduce((sum, b) => sum + Math.pow(b - mean, 2), 0) / validBetas.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...validBetas);
  const max = Math.max(...validBetas);
  const range = max - min;
  const cv = mean !== 0 ? std / Math.abs(mean) : 0;

  // Determine trend using linear regression on recent values
  const recentBetas = validBetas.slice(-30);
  const n = recentBetas.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recentBetas[i];
    sumXY += i * recentBetas[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const slopeThreshold = std * 0.01; // Threshold relative to volatility

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (slope > slopeThreshold) trend = "increasing";
  else if (slope < -slopeThreshold) trend = "decreasing";

  // Stable if CV < 20%
  const isStable = cv < 0.20;

  return {
    mean,
    std,
    min,
    max,
    range,
    cv,
    isStable,
    trend,
  };
}
