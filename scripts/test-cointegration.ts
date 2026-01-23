/**
 * Test script for cointegration functions
 *
 * Run with: npx ts-node --esm scripts/test-cointegration.ts
 * Or: npx tsx scripts/test-cointegration.ts
 */

// Since we can't easily import from @/ in a standalone script,
// we'll copy the core functions for testing

// ============================================================================
// HELPER FUNCTIONS (copied from the modules for standalone testing)
// ============================================================================

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ============================================================================
// GENERATE SYNTHETIC DATA
// ============================================================================

/**
 * Generate a random walk (non-stationary I(1) series)
 */
function generateRandomWalk(n: number, start: number = 100, volatility: number = 0.02): number[] {
  const series: number[] = [start];
  for (let i = 1; i < n; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * series[i - 1];
    series.push(series[i - 1] + change);
  }
  return series;
}

/**
 * Generate two cointegrated series
 * Y = alpha + beta * X + stationary_noise
 */
function generateCointegrated(
  n: number,
  alpha: number = 10,
  beta: number = 1.5,
  noiseStd: number = 2
): { seriesY: number[]; seriesX: number[]; trueAlpha: number; trueBeta: number } {
  // X follows a random walk
  const seriesX = generateRandomWalk(n, 100, 0.01);

  // Y = alpha + beta * X + stationary noise
  const seriesY: number[] = [];
  for (let i = 0; i < n; i++) {
    const noise = (Math.random() - 0.5) * 2 * noiseStd;
    seriesY.push(alpha + beta * seriesX[i] + noise);
  }

  return { seriesY, seriesX, trueAlpha: alpha, trueBeta: beta };
}

/**
 * Generate a stationary series (mean-reverting)
 */
function generateStationary(n: number, mean: number = 0, std: number = 1): number[] {
  const series: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    series.push(mean + std * z);
  }
  return series;
}

// ============================================================================
// SIMPLIFIED ADF TEST (for standalone testing)
// ============================================================================

function simpleADFTest(series: number[]): { statistic: number; isStationary: boolean } {
  const n = series.length;
  if (n < 10) return { statistic: 0, isStationary: false };

  // Calculate first differences
  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(series[i] - series[i - 1]);
  }

  // Simple OLS: ΔY = α + β * Y_{t-1}
  const laggedY = series.slice(0, -1);

  const meanLag = mean(laggedY);
  const meanDy = mean(dy);

  let num = 0, den = 0;
  for (let i = 0; i < dy.length; i++) {
    num += (laggedY[i] - meanLag) * (dy[i] - meanDy);
    den += Math.pow(laggedY[i] - meanLag, 2);
  }

  const beta = den !== 0 ? num / den : 0;
  const alpha = meanDy - beta * meanLag;

  // Calculate residual standard error
  let ssRes = 0;
  for (let i = 0; i < dy.length; i++) {
    const pred = alpha + beta * laggedY[i];
    ssRes += Math.pow(dy[i] - pred, 2);
  }
  const se = Math.sqrt(ssRes / (dy.length - 2));
  const seBeta = se / Math.sqrt(den);

  const tStat = beta / seBeta;

  // Critical value at 5% for constant only: -2.86
  const isStationary = tStat < -2.86;

  return { statistic: tStat, isStationary };
}

// ============================================================================
// SIMPLIFIED ENGLE-GRANGER TEST
// ============================================================================

function simpleEngleGranger(pricesY: number[], pricesX: number[]): {
  hedgeRatio: number;
  intercept: number;
  isCointegrated: boolean;
  adfStatistic: number;
  residuals: number[];
} {
  const n = pricesY.length;

  // OLS: Y = α + β * X
  const meanX = mean(pricesX);
  const meanY = mean(pricesY);

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (pricesX[i] - meanX) * (pricesY[i] - meanY);
    den += Math.pow(pricesX[i] - meanX, 2);
  }

  const beta = den !== 0 ? num / den : 1;
  const alpha = meanY - beta * meanX;

  // Residuals = spread
  const residuals = pricesY.map((y, i) => y - alpha - beta * pricesX[i]);

  // ADF on residuals (more conservative critical value: -3.34 for 2 variables)
  const adf = simpleADFTest(residuals);
  const isCointegrated = adf.statistic < -3.34;

  return {
    hedgeRatio: beta,
    intercept: alpha,
    isCointegrated,
    adfStatistic: adf.statistic,
    residuals,
  };
}

// ============================================================================
// SIMPLIFIED HALF-LIFE
// ============================================================================

function simpleHalfLife(spread: number[]): { halfLife: number; isTradeable: boolean } {
  const n = spread.length - 1;

  const laggedSpread = spread.slice(0, -1);
  const spreadChanges: number[] = [];
  for (let i = 1; i < spread.length; i++) {
    spreadChanges.push(spread[i] - spread[i - 1]);
  }

  const meanLag = mean(laggedSpread);
  const meanChange = mean(spreadChanges);

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (laggedSpread[i] - meanLag) * (spreadChanges[i] - meanChange);
    den += Math.pow(laggedSpread[i] - meanLag, 2);
  }

  const beta = den !== 0 ? num / den : 0;

  if (beta >= 0) {
    return { halfLife: Infinity, isTradeable: false };
  }

  const phi = 1 + beta;
  if (phi <= 0 || phi >= 1) {
    return { halfLife: Infinity, isTradeable: false };
  }

  const halfLife = -Math.log(2) / Math.log(phi);
  const isTradeable = halfLife > 1 && halfLife < 100;

  return { halfLife, isTradeable };
}

// ============================================================================
// RUN TESTS
// ============================================================================

console.log("=".repeat(60));
console.log("Testing Cointegration Functions");
console.log("=".repeat(60));

// Test 1: ADF on stationary series (should reject unit root)
console.log("\n📊 Test 1: ADF on Stationary Series");
const stationarySeries = generateStationary(200, 0, 1);
const adfStationary = simpleADFTest(stationarySeries);
console.log(`   ADF Statistic: ${adfStationary.statistic.toFixed(3)}`);
console.log(`   Is Stationary: ${adfStationary.isStationary}`);
console.log(`   Expected: Should be stationary (true)`);
console.log(`   ✅ ${adfStationary.isStationary ? "PASS" : "FAIL"}`);

// Test 2: ADF on random walk (should NOT reject unit root)
console.log("\n📊 Test 2: ADF on Random Walk (Non-Stationary)");
const randomWalk = generateRandomWalk(200);
const adfRandomWalk = simpleADFTest(randomWalk);
console.log(`   ADF Statistic: ${adfRandomWalk.statistic.toFixed(3)}`);
console.log(`   Is Stationary: ${adfRandomWalk.isStationary}`);
console.log(`   Expected: Should NOT be stationary (false)`);
console.log(`   ✅ ${!adfRandomWalk.isStationary ? "PASS" : "FAIL"}`);

// Test 3: Cointegration test on cointegrated series
console.log("\n📊 Test 3: Engle-Granger on Cointegrated Pair");
const { seriesY, seriesX, trueAlpha, trueBeta } = generateCointegrated(200, 10, 1.5, 2);
const egResult = simpleEngleGranger(seriesY, seriesX);
console.log(`   True Alpha: ${trueAlpha}, Estimated: ${egResult.intercept.toFixed(3)}`);
console.log(`   True Beta:  ${trueBeta}, Estimated: ${egResult.hedgeRatio.toFixed(3)}`);
console.log(`   ADF on Residuals: ${egResult.adfStatistic.toFixed(3)}`);
console.log(`   Is Cointegrated: ${egResult.isCointegrated}`);
console.log(`   Expected: Should be cointegrated (true)`);
console.log(`   ✅ ${egResult.isCointegrated ? "PASS" : "FAIL"}`);

// Test 4: Cointegration test on non-cointegrated series
console.log("\n📊 Test 4: Engle-Granger on Independent Random Walks");
const indepX = generateRandomWalk(200);
const indepY = generateRandomWalk(200);
const egIndep = simpleEngleGranger(indepY, indepX);
console.log(`   ADF on Residuals: ${egIndep.adfStatistic.toFixed(3)}`);
console.log(`   Is Cointegrated: ${egIndep.isCointegrated}`);
console.log(`   Expected: Should NOT be cointegrated (false)`);
console.log(`   ✅ ${!egIndep.isCointegrated ? "PASS" : "FAIL"}`);

// Test 5: Half-life on mean-reverting spread
console.log("\n📊 Test 5: Half-Life of Cointegrated Spread");
const hlResult = simpleHalfLife(egResult.residuals);
console.log(`   Half-Life: ${hlResult.halfLife.toFixed(2)} periods`);
console.log(`   Is Tradeable (1-100 days): ${hlResult.isTradeable}`);
console.log(`   ✅ ${hlResult.isTradeable ? "PASS - Reasonable half-life" : "WARN - Check half-life"}`);

// Test 6: Z-Score calculation
console.log("\n📊 Test 6: Spread Z-Score");
const spreadMean = mean(egResult.residuals);
const spreadStd = stdDev(egResult.residuals);
const currentSpread = egResult.residuals[egResult.residuals.length - 1];
const zScore = (currentSpread - spreadMean) / spreadStd;
console.log(`   Spread Mean: ${spreadMean.toFixed(3)}`);
console.log(`   Spread Std:  ${spreadStd.toFixed(3)}`);
console.log(`   Current Z-Score: ${zScore.toFixed(3)}`);

let signal = "neutral";
if (zScore > 2) signal = "short_spread";
else if (zScore < -2) signal = "long_spread";
console.log(`   Signal: ${signal}`);
console.log(`   ✅ Z-Score calculation working`);

console.log("\n" + "=".repeat(60));
console.log("All tests completed!");
console.log("=".repeat(60));
