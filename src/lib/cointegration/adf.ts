/**
 * Augmented Dickey-Fuller Test Implementation
 *
 * Tests for unit root (non-stationarity) in a time series.
 * H0: Series has a unit root (non-stationary)
 * H1: Series is stationary
 *
 * If p-value < 0.05, reject H0 → series is stationary
 *
 * Reference: MacKinnon (1994, 2010) critical values
 */

import type { ADFResult } from "@/types/arbitrage";

/**
 * MacKinnon (2010) critical values for ADF test
 * These are approximate values for common sample sizes
 * Format: { regression_type: { significance_level: value } }
 */
const MACKINNON_CRITICAL_VALUES = {
  // No constant, no trend
  n: {
    "1%": -2.58,
    "5%": -1.95,
    "10%": -1.62,
  },
  // Constant only
  c: {
    "1%": -3.43,
    "5%": -2.86,
    "10%": -2.57,
  },
  // Constant and trend
  ct: {
    "1%": -3.96,
    "5%": -3.41,
    "10%": -3.12,
  },
};

/**
 * MacKinnon (1994) p-value approximation coefficients
 * Used for interpolating p-values from ADF statistic
 */
const MACKINNON_PVALUE_COEFS = {
  c: {
    small: [-3.4336, -5.999, -29.25, -8.45],
    large: [-3.4336, -5.999, -29.25, -8.45],
  },
  ct: {
    small: [-3.9638, -8.353, -47.44, -17.83],
    large: [-3.9638, -8.353, -47.44, -17.83],
  },
  n: {
    small: [-2.5658, -1.960, -10.04, 0],
    large: [-2.5658, -1.960, -10.04, 0],
  },
};

/**
 * Calculate mean of an array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate variance of an array
 */
function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1);
}

/**
 * Ordinary Least Squares regression
 * Returns coefficients and residuals
 *
 * y = X * beta + epsilon
 */
function ols(y: number[], X: number[][]): {
  beta: number[];
  residuals: number[];
  se: number[];
  rss: number;
} {
  const n = y.length;
  const k = X[0]?.length || 0;

  if (n === 0 || k === 0) {
    return { beta: [], residuals: [], se: [], rss: 0 };
  }

  // X'X
  const XtX: number[][] = Array(k).fill(null).map(() => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      for (let t = 0; t < n; t++) {
        XtX[i][j] += X[t][i] * X[t][j];
      }
    }
  }

  // X'y
  const Xty: number[] = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let t = 0; t < n; t++) {
      Xty[i] += X[t][i] * y[t];
    }
  }

  // Solve (X'X) * beta = X'y using Cholesky decomposition
  const beta = solveLinearSystem(XtX, Xty);

  // Calculate residuals
  const residuals: number[] = [];
  for (let t = 0; t < n; t++) {
    let yHat = 0;
    for (let i = 0; i < k; i++) {
      yHat += X[t][i] * beta[i];
    }
    residuals.push(y[t] - yHat);
  }

  // RSS and standard errors
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const s2 = rss / (n - k);

  // (X'X)^-1 for standard errors
  const XtXinv = invertMatrix(XtX);
  const se: number[] = [];
  for (let i = 0; i < k; i++) {
    se.push(Math.sqrt(s2 * XtXinv[i][i]));
  }

  return { beta, residuals, se, rss };
}

/**
 * Solve linear system Ax = b using Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;

  // Create augmented matrix
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Check for singular matrix
    if (Math.abs(aug[col][col]) < 1e-10) {
      // Add small value to avoid division by zero
      aug[col][col] = 1e-10;
    }

    // Eliminate column
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x: number[] = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    x[row] = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      x[row] -= aug[row][col] * x[col];
    }
    x[row] /= aug[row][row];
  }

  return x;
}

/**
 * Matrix inversion using Gauss-Jordan elimination
 */
function invertMatrix(A: number[][]): number[][] {
  const n = A.length;

  // Create augmented matrix [A|I]
  const aug: number[][] = A.map((row, i) => {
    const identity = new Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }

    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) {
      aug[col][col] = 1e-10;
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
  }

  // Extract inverse
  return aug.map(row => row.slice(n));
}

/**
 * Calculate AIC (Akaike Information Criterion)
 */
function calculateAIC(rss: number, n: number, k: number): number {
  if (n <= 0 || rss <= 0) return Infinity;
  return n * Math.log(rss / n) + 2 * k;
}

/**
 * Calculate BIC (Bayesian Information Criterion)
 */
function calculateBIC(rss: number, n: number, k: number): number {
  if (n <= 0 || rss <= 0) return Infinity;
  return n * Math.log(rss / n) + k * Math.log(n);
}

/**
 * Determine optimal lag length using information criterion
 */
function selectOptimalLag(
  y: number[],
  maxLag: number,
  regression: "c" | "ct" | "n",
  criterion: "aic" | "bic" = "aic"
): number {
  let bestLag = 0;
  let bestIC = Infinity;

  for (let lag = 0; lag <= maxLag; lag++) {
    const result = runADFRegression(y, lag, regression);
    if (!result) continue;

    const ic = criterion === "aic"
      ? calculateAIC(result.rss, result.n, result.k)
      : calculateBIC(result.rss, result.n, result.k);

    if (ic < bestIC) {
      bestIC = ic;
      bestLag = lag;
    }
  }

  return bestLag;
}

/**
 * Run the ADF regression
 *
 * Δy_t = α + βt + γy_{t-1} + Σδ_i Δy_{t-i} + ε_t
 *
 * where:
 * - α is constant (if regression includes 'c')
 * - βt is trend (if regression includes 't')
 * - γ is the coefficient we test (should be negative and significant for stationarity)
 * - δ_i are coefficients on lagged differences
 */
function runADFRegression(
  y: number[],
  nLags: number,
  regression: "c" | "ct" | "n"
): {
  gamma: number;
  tStat: number;
  rss: number;
  n: number;
  k: number;
} | null {
  const n = y.length;
  if (n < nLags + 3) return null;

  // Calculate first differences
  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(y[i] - y[i - 1]);
  }

  // Build regression matrices
  // Start index to have enough lags
  const startIdx = nLags + 1;
  const T = dy.length - startIdx;

  if (T < 3) return null;

  const yVec: number[] = [];
  const X: number[][] = [];

  for (let t = startIdx; t < dy.length; t++) {
    yVec.push(dy[t]);

    const row: number[] = [];

    // Lagged level y_{t-1}
    row.push(y[t]); // y[t] corresponds to y_{t-1} when predicting dy[t] = y_{t+1} - y_t

    // Constant
    if (regression === "c" || regression === "ct") {
      row.push(1);
    }

    // Trend
    if (regression === "ct") {
      row.push(t - startIdx + 1);
    }

    // Lagged differences
    for (let lag = 1; lag <= nLags; lag++) {
      row.push(dy[t - lag]);
    }

    X.push(row);
  }

  // Run OLS
  const { beta, se, rss } = ols(yVec, X);

  if (beta.length === 0 || se.length === 0) return null;

  // gamma is the first coefficient (on lagged level)
  const gamma = beta[0];
  const seGamma = se[0];

  if (seGamma === 0 || !isFinite(seGamma)) return null;

  const tStat = gamma / seGamma;

  return {
    gamma,
    tStat,
    rss,
    n: T,
    k: beta.length,
  };
}

/**
 * Approximate p-value using MacKinnon (1994) response surface
 * This is a simplified approximation
 */
function approximatePValue(tStat: number, n: number, regression: "c" | "ct" | "n"): number {
  // Get critical values for reference
  const cv = MACKINNON_CRITICAL_VALUES[regression];

  // Simple interpolation based on critical values
  // This is approximate but sufficient for practical use

  if (tStat <= cv["1%"]) {
    // Very significant, p < 0.01
    return 0.001 + (tStat - cv["1%"]) * 0.001;
  } else if (tStat <= cv["5%"]) {
    // Between 1% and 5%
    const range = cv["1%"] - cv["5%"];
    const position = (cv["1%"] - tStat) / range;
    return 0.01 + position * 0.04;
  } else if (tStat <= cv["10%"]) {
    // Between 5% and 10%
    const range = cv["5%"] - cv["10%"];
    const position = (cv["5%"] - tStat) / range;
    return 0.05 + position * 0.05;
  } else if (tStat <= 0) {
    // Between 10% and ~50%
    const range = cv["10%"];
    const position = (cv["10%"] - tStat) / Math.abs(range);
    return Math.min(0.5, 0.10 + position * 0.40);
  } else {
    // Positive statistic, definitely not stationary
    return Math.min(0.99, 0.5 + tStat * 0.1);
  }
}

/**
 * Augmented Dickey-Fuller Test
 *
 * @param series - Time series to test
 * @param maxLag - Maximum number of lags (default: auto-select)
 * @param regression - Type of regression: 'c' (constant), 'ct' (constant+trend), 'n' (none)
 * @param autolag - Method for selecting lag: 'AIC', 'BIC', or null for maxLag
 * @returns ADF test result
 */
export function adfTest(
  series: number[],
  options: {
    maxLag?: number;
    regression?: "c" | "ct" | "n";
    autolag?: "aic" | "bic" | null;
  } = {}
): ADFResult {
  const {
    maxLag = Math.floor(Math.pow(series.length - 1, 1/3)),
    regression = "c",
    autolag = "aic",
  } = options;

  // Default result for invalid input
  const defaultResult: ADFResult = {
    statistic: 0,
    pValue: 1,
    criticalValues: MACKINNON_CRITICAL_VALUES[regression],
    isStationary: false,
    nLags: 0,
    regression,
  };

  if (series.length < 10) {
    console.warn("ADF test requires at least 10 observations");
    return defaultResult;
  }

  // Check for constant series
  const seriesVariance = variance(series);
  if (seriesVariance < 1e-10) {
    // Constant series is trivially stationary
    return {
      ...defaultResult,
      statistic: -Infinity,
      pValue: 0,
      isStationary: true,
    };
  }

  // Select optimal lag
  const nLags = autolag
    ? selectOptimalLag(series, Math.min(maxLag, Math.floor(series.length / 3)), regression, autolag)
    : maxLag;

  // Run ADF regression
  const result = runADFRegression(series, nLags, regression);

  if (!result) {
    console.warn("ADF regression failed - insufficient data");
    return defaultResult;
  }

  // Calculate p-value
  const pValue = approximatePValue(result.tStat, result.n, regression);

  // Determine if stationary at 5% significance
  const isStationary = result.tStat < MACKINNON_CRITICAL_VALUES[regression]["5%"];

  return {
    statistic: result.tStat,
    pValue: Math.max(0, Math.min(1, pValue)),
    criticalValues: MACKINNON_CRITICAL_VALUES[regression],
    isStationary,
    nLags,
    regression,
  };
}

/**
 * Test if a series is I(1) (integrated of order 1)
 *
 * A series is I(1) if:
 * - The level series is non-stationary (fails ADF)
 * - The first difference is stationary (passes ADF)
 */
export function testIntegrationOrder(series: number[]): {
  isI1: boolean;
  levelADF: ADFResult;
  diffADF: ADFResult;
} {
  // Test level
  const levelADF = adfTest(series);

  // Calculate first differences
  const diff: number[] = [];
  for (let i = 1; i < series.length; i++) {
    diff.push(series[i] - series[i - 1]);
  }

  // Test differences
  const diffADF = adfTest(diff);

  // I(1) if level is non-stationary but difference is stationary
  const isI1 = !levelADF.isStationary && diffADF.isStationary;

  return {
    isI1,
    levelADF,
    diffADF,
  };
}
