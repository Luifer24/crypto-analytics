/**
 * Kalman Filter for Dynamic Hedge Ratio Estimation
 *
 * State-Space Model:
 *   Observation: y_t = α_t + β_t * x_t + ε_t    (ε_t ~ N(0, Ve))
 *   State:       [α_t, β_t]' = [α_{t-1}, β_{t-1}]' + ω_t   (ω_t ~ N(0, Vw))
 *
 * Where:
 *   y_t = price of asset Y at time t
 *   x_t = price of asset X at time t
 *   α_t = dynamic intercept
 *   β_t = dynamic hedge ratio
 *
 * The Kalman filter adaptively estimates α and β as new data arrives,
 * allowing the hedge ratio to evolve over time.
 *
 * Reference: Kalman (1960), Ernest Chan's "Algorithmic Trading"
 */

import type { KalmanState, KalmanConfig, KalmanFilterResult } from "@/types/arbitrage";

// Default configuration
const DEFAULT_CONFIG: KalmanConfig = {
  delta: 0.0001,      // Process noise - controls adaptation speed
  initialP: 1,        // Initial state covariance
  initialVe: 0.001,   // Initial observation variance
};

/**
 * Kalman Filter class for pairs trading
 *
 * Estimates time-varying hedge ratio β_t using recursive Bayesian estimation.
 */
export class KalmanFilter {
  private config: KalmanConfig;
  private state: KalmanState;

  // History for analysis
  private alphaHistory: number[] = [];
  private betaHistory: number[] = [];
  private spreadHistory: number[] = [];
  private predictionErrors: number[] = [];

  constructor(config: Partial<KalmanConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize state
    this.state = {
      alpha: 0,
      beta: 1, // Start with hedge ratio of 1
      P: [
        [this.config.initialP, 0],
        [0, this.config.initialP],
      ],
      Ve: this.config.initialVe,
    };
  }

  /**
   * Process a single observation and update state estimates
   *
   * @param y - Price of asset Y (dependent variable)
   * @param x - Price of asset X (independent variable)
   * @returns Updated state
   */
  update(y: number, x: number): KalmanState {
    const { alpha, beta, P, Ve } = this.state;
    const { delta } = this.config;

    // Observation matrix: H = [1, x]
    const H = [1, x];

    // ================================================
    // PREDICT STEP
    // ================================================

    // State prediction (random walk - no change expected)
    const alphaPred = alpha;
    const betaPred = beta;

    // Covariance prediction: P_pred = P + Q
    // Q = delta * I (process noise covariance)
    const PPred = [
      [P[0][0] + delta, P[0][1]],
      [P[1][0], P[1][1] + delta],
    ];

    // ================================================
    // UPDATE STEP
    // ================================================

    // Prediction error (innovation)
    const yPred = alphaPred + betaPred * x;
    const e = y - yPred;

    // Innovation variance: S = H * P_pred * H' + Ve
    // S = [1, x] * P_pred * [1, x]' + Ve
    const S = H[0] * (PPred[0][0] * H[0] + PPred[0][1] * H[1]) +
              H[1] * (PPred[1][0] * H[0] + PPred[1][1] * H[1]) + Ve;

    // Kalman gain: K = P_pred * H' / S
    // K is a 2x1 vector
    const K = [
      (PPred[0][0] * H[0] + PPred[0][1] * H[1]) / S,
      (PPred[1][0] * H[0] + PPred[1][1] * H[1]) / S,
    ];

    // State update: x_new = x_pred + K * e
    const alphaNew = alphaPred + K[0] * e;
    const betaNew = betaPred + K[1] * e;

    // Covariance update: P_new = (I - K * H) * P_pred
    // Using Joseph form for numerical stability:
    // P_new = (I - K*H) * P_pred * (I - K*H)' + K * Ve * K'
    const IKH = [
      [1 - K[0] * H[0], -K[0] * H[1]],
      [-K[1] * H[0], 1 - K[1] * H[1]],
    ];

    const PNew = [
      [
        IKH[0][0] * PPred[0][0] + IKH[0][1] * PPred[1][0],
        IKH[0][0] * PPred[0][1] + IKH[0][1] * PPred[1][1],
      ],
      [
        IKH[1][0] * PPred[0][0] + IKH[1][1] * PPred[1][0],
        IKH[1][0] * PPred[0][1] + IKH[1][1] * PPred[1][1],
      ],
    ];

    // Update observation variance estimate (exponential smoothing)
    const VeNew = 0.99 * Ve + 0.01 * e * e;

    // Update state
    this.state = {
      alpha: alphaNew,
      beta: betaNew,
      P: PNew,
      Ve: VeNew,
    };

    // Store history
    this.alphaHistory.push(alphaNew);
    this.betaHistory.push(betaNew);
    this.predictionErrors.push(e);

    // Calculate spread using updated parameters
    const spread = y - alphaNew - betaNew * x;
    this.spreadHistory.push(spread);

    return this.state;
  }

  /**
   * Process multiple observations at once
   *
   * @param pricesY - Array of Y prices
   * @param pricesX - Array of X prices
   * @returns Filter result with full history
   */
  filter(pricesY: number[], pricesX: number[]): KalmanFilterResult {
    if (pricesY.length !== pricesX.length) {
      throw new Error("Price series must have the same length");
    }

    // Reset state for fresh filtering
    this.reset();

    // Process all observations
    for (let i = 0; i < pricesY.length; i++) {
      this.update(pricesY[i], pricesX[i]);
    }

    // Calculate Z-Scores from spread
    const zScoreHistory = this.calculateZScores(this.spreadHistory);

    return {
      alphaHistory: [...this.alphaHistory],
      betaHistory: [...this.betaHistory],
      spreadHistory: [...this.spreadHistory],
      zScoreHistory,
      currentState: { ...this.state },
      currentSpread: this.spreadHistory[this.spreadHistory.length - 1],
      currentZScore: zScoreHistory[zScoreHistory.length - 1],
    };
  }

  /**
   * Get current spread value
   */
  getSpread(y: number, x: number): number {
    return y - this.state.alpha - this.state.beta * x;
  }

  /**
   * Get current state
   */
  getState(): KalmanState {
    return { ...this.state };
  }

  /**
   * Get hedge ratio (beta)
   */
  getHedgeRatio(): number {
    return this.state.beta;
  }

  /**
   * Get intercept (alpha)
   */
  getIntercept(): number {
    return this.state.alpha;
  }

  /**
   * Reset filter to initial state
   */
  reset(): void {
    this.state = {
      alpha: 0,
      beta: 1,
      P: [
        [this.config.initialP, 0],
        [0, this.config.initialP],
      ],
      Ve: this.config.initialVe,
    };
    this.alphaHistory = [];
    this.betaHistory = [];
    this.spreadHistory = [];
    this.predictionErrors = [];
  }

  /**
   * Calculate rolling Z-Scores from spread
   */
  private calculateZScores(spread: number[], lookback: number = 20): number[] {
    const zScores: number[] = [];

    for (let i = 0; i < spread.length; i++) {
      if (i < lookback - 1) {
        zScores.push(NaN);
        continue;
      }

      const window = spread.slice(i - lookback + 1, i + 1);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
      const std = Math.sqrt(variance);

      if (std === 0) {
        zScores.push(0);
      } else {
        zScores.push((spread[i] - mean) / std);
      }
    }

    return zScores;
  }
}

/**
 * Run Kalman filter on price series and return full analysis
 *
 * Convenience function that creates a filter, processes data, and returns results.
 *
 * @param pricesY - Dependent variable prices
 * @param pricesX - Independent variable prices
 * @param config - Optional filter configuration
 * @returns Kalman filter results
 */
export function runKalmanFilter(
  pricesY: number[],
  pricesX: number[],
  config: Partial<KalmanConfig> = {}
): KalmanFilterResult {
  const filter = new KalmanFilter(config);
  return filter.filter(pricesY, pricesX);
}

/**
 * Compare static (OLS) vs dynamic (Kalman) hedge ratios
 *
 * @param pricesY - Dependent variable prices
 * @param pricesX - Independent variable prices
 * @param staticBeta - Static hedge ratio from OLS regression
 * @param staticAlpha - Static intercept from OLS regression
 * @returns Comparison metrics
 */
export function compareStaticVsDynamic(
  pricesY: number[],
  pricesX: number[],
  staticBeta: number,
  staticAlpha: number
): {
  staticSpread: number[];
  dynamicSpread: number[];
  staticZScore: number[];
  dynamicZScore: number[];
  betaHistory: number[];
  correlationImprovement: number;
  varianceReduction: number;
} {
  // Calculate static spread
  const staticSpread = pricesY.map((y, i) => y - staticAlpha - staticBeta * pricesX[i]);

  // Run Kalman filter
  const kalmanResult = runKalmanFilter(pricesY, pricesX);

  // Calculate static Z-Scores
  const staticZScore = calculateZScoresSimple(staticSpread, 20);

  // Calculate variance of spreads (lower is better)
  const staticVariance = variance(staticSpread);
  const dynamicVariance = variance(kalmanResult.spreadHistory);

  // Variance reduction (positive means Kalman is better)
  const varianceReduction = staticVariance > 0
    ? ((staticVariance - dynamicVariance) / staticVariance) * 100
    : 0;

  // Calculate autocorrelation of spreads (lower lag-1 autocorr is better for mean reversion)
  const staticAutocorr = lag1Autocorrelation(staticSpread);
  const dynamicAutocorr = lag1Autocorrelation(kalmanResult.spreadHistory);

  // Correlation improvement (lower autocorr = faster mean reversion)
  const correlationImprovement = Math.abs(staticAutocorr) > 0
    ? ((Math.abs(staticAutocorr) - Math.abs(dynamicAutocorr)) / Math.abs(staticAutocorr)) * 100
    : 0;

  return {
    staticSpread,
    dynamicSpread: kalmanResult.spreadHistory,
    staticZScore,
    dynamicZScore: kalmanResult.zScoreHistory,
    betaHistory: kalmanResult.betaHistory,
    correlationImprovement,
    varianceReduction,
  };
}

// Helper: Calculate Z-Scores
function calculateZScoresSimple(spread: number[], lookback: number): number[] {
  const zScores: number[] = [];

  for (let i = 0; i < spread.length; i++) {
    if (i < lookback - 1) {
      zScores.push(NaN);
      continue;
    }

    const window = spread.slice(i - lookback + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const std = Math.sqrt(
      window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length
    );

    zScores.push(std === 0 ? 0 : (spread[i] - mean) / std);
  }

  return zScores;
}

// Helper: Calculate variance
function variance(values: number[]): number {
  const validValues = values.filter(v => !isNaN(v));
  if (validValues.length < 2) return 0;

  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  return validValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / validValues.length;
}

// Helper: Calculate lag-1 autocorrelation
function lag1Autocorrelation(values: number[]): number {
  const validValues = values.filter(v => !isNaN(v));
  if (validValues.length < 3) return 0;

  const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
  const n = validValues.length;

  let num = 0;
  let den = 0;

  for (let i = 0; i < n - 1; i++) {
    num += (validValues[i] - mean) * (validValues[i + 1] - mean);
  }

  for (let i = 0; i < n; i++) {
    den += Math.pow(validValues[i] - mean, 2);
  }

  return den === 0 ? 0 : num / den;
}
