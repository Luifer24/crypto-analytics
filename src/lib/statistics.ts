export interface DescriptiveStats {
  mean: number;
  median: number;
  variance: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  range: number;
  count: number;
}

export interface ReturnStats {
  dailyReturns: number[];
  meanReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positiveCount: number;
  negativeCount: number;
  winRate: number;
}

export interface CorrelationResult {
  correlation: number;
  pValue: number;
  interpretation: string;
}

export interface CointegrationResult {
  spread: number[];
  meanSpread: number;
  stdSpread: number;
  zScore: number;
  isCointegrated: boolean;
  halfLife: number;
}

export const mean = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
};

export const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const variance = (values: number[], isSample = true): number => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
  const divisor = isSample ? values.length - 1 : values.length;
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / divisor;
};

export const stdDev = (values: number[], isSample = true): number => {
  return Math.sqrt(variance(values, isSample));
};

export const skewness = (values: number[]): number => {
  if (values.length < 3) return 0;
  const n = values.length;
  const avg = mean(values);
  const std = stdDev(values, false);
  if (std === 0) return 0;

  const cubedDiffs = values.map(val => Math.pow((val - avg) / std, 3));
  const sum = cubedDiffs.reduce((acc, val) => acc + val, 0);

  return (n / ((n - 1) * (n - 2))) * sum;
};

export const kurtosis = (values: number[]): number => {
  if (values.length < 4) return 0;
  const n = values.length;
  const avg = mean(values);
  const std = stdDev(values, false);
  if (std === 0) return 0;

  const fourthPowers = values.map(val => Math.pow((val - avg) / std, 4));
  const sum = fourthPowers.reduce((acc, val) => acc + val, 0);

  const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
  const factor2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));

  return factor1 * sum - factor2;
};

export const getDescriptiveStats = (values: number[]): DescriptiveStats => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: mean(values),
    median: median(values),
    variance: variance(values),
    stdDev: stdDev(values),
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    range: (sorted[sorted.length - 1] || 0) - (sorted[0] || 0),
    count: values.length,
  };
};

export const calculateReturns = (prices: number[], useLog = true): number[] => {
  if (prices.length < 2) return [];
  const returns: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) continue;
    if (useLog) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    } else {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  return returns;
};

export const getReturnStats = (prices: number[], riskFreeRate = 0): ReturnStats => {
  const dailyReturns = calculateReturns(prices, false);
  const meanReturn = mean(dailyReturns);
  const volatility = stdDev(dailyReturns);

  const annualizedReturn = meanReturn * 365;
  const annualizedVol = volatility * Math.sqrt(365);
  const sharpeRatio = annualizedVol > 0
    ? (annualizedReturn - riskFreeRate) / annualizedVol
    : 0;

  let peak = prices[0] || 0;
  let maxDrawdown = 0;
  for (const price of prices) {
    if (price > peak) peak = price;
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const positiveCount = dailyReturns.filter(r => r > 0).length;
  const negativeCount = dailyReturns.filter(r => r < 0).length;

  return {
    dailyReturns,
    meanReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    positiveCount,
    negativeCount,
    winRate: dailyReturns.length > 0 ? positiveCount / dailyReturns.length : 0,
  };
};

export const correlation = (x: number[], y: number[]): number => {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
};

const normalCDF = (x: number): number => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
};

export const getCorrelation = (x: number[], y: number[]): CorrelationResult => {
  const corr = correlation(x, y);
  const n = x.length;

  const tStat = corr * Math.sqrt((n - 2) / (1 - corr * corr));
  const pValue = n > 30 ? 2 * (1 - normalCDF(Math.abs(tStat))) : 0.05;

  let interpretation = "";
  const absCorr = Math.abs(corr);
  if (absCorr >= 0.8) interpretation = "Correlación muy fuerte";
  else if (absCorr >= 0.6) interpretation = "Correlación fuerte";
  else if (absCorr >= 0.4) interpretation = "Correlación moderada";
  else if (absCorr >= 0.2) interpretation = "Correlación débil";
  else interpretation = "Correlación muy débil o nula";

  if (corr < 0) interpretation += " (negativa)";
  else if (corr > 0) interpretation += " (positiva)";

  return { correlation: corr, pValue, interpretation };
};

export const getCointegration = (pricesA: number[], pricesB: number[]): CointegrationResult => {
  if (pricesA.length !== pricesB.length || pricesA.length < 10) {
    return {
      spread: [],
      meanSpread: 0,
      stdSpread: 0,
      zScore: 0,
      isCointegrated: false,
      halfLife: 0,
    };
  }

  const meanA = mean(pricesA);
  const meanB = mean(pricesB);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < pricesA.length; i++) {
    numerator += (pricesA[i] - meanA) * (pricesB[i] - meanB);
    denominator += (pricesB[i] - meanB) * (pricesB[i] - meanB);
  }
  const hedgeRatio = denominator !== 0 ? numerator / denominator : 1;

  const spread = pricesA.map((a, i) => a - hedgeRatio * pricesB[i]);
  const meanSpread = mean(spread);
  const stdSpread = stdDev(spread);

  const currentSpread = spread[spread.length - 1];
  const zScore = stdSpread !== 0 ? (currentSpread - meanSpread) / stdSpread : 0;

  const laggedSpread = spread.slice(0, -1);
  const currentSpreadArr = spread.slice(1);
  const spreadChanges = currentSpreadArr.map((s, i) => s - laggedSpread[i]);

  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
  const n = laggedSpread.length;
  for (let i = 0; i < n; i++) {
    sumX += laggedSpread[i];
    sumY += spreadChanges[i];
    sumXY += laggedSpread[i] * spreadChanges[i];
    sumX2 += laggedSpread[i] * laggedSpread[i];
  }

  const beta = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const halfLife = beta < 0 ? -Math.log(2) / beta : Infinity;

  const isCointegrated = halfLife > 1 && halfLife < 100 && Math.abs(zScore) < 3;

  return {
    spread,
    meanSpread,
    stdSpread,
    zScore,
    isCointegrated,
    halfLife: isFinite(halfLife) ? halfLife : 0,
  };
};

export const sma = (values: number[], period: number): number[] => {
  if (values.length < period) return [];
  const result: number[] = [];

  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    result.push(mean(window));
  }

  return result;
};

export const ema = (values: number[], period: number): number[] => {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  let emaValue = mean(values.slice(0, period));
  result.push(emaValue);

  for (let i = period; i < values.length; i++) {
    emaValue = (values[i] - emaValue) * multiplier + emaValue;
    result.push(emaValue);
  }

  return result;
};

export const bollingerBands = (values: number[], period: number = 20, stdMultiplier: number = 2) => {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const std = stdDev(window);
    const idx = i - period + 1;
    upper.push(middle[idx] + stdMultiplier * std);
    lower.push(middle[idx] - stdMultiplier * std);
  }

  return { upper, middle, lower };
};

export const rollingVolatility = (prices: number[], window: number = 20): number[] => {
  const returns = calculateReturns(prices);
  if (returns.length < window) return [];

  const result: number[] = [];
  for (let i = window - 1; i < returns.length; i++) {
    const windowReturns = returns.slice(i - window + 1, i + 1);
    result.push(stdDev(windowReturns) * Math.sqrt(365));
  }

  return result;
};

export const acf = (values: number[], maxLag: number = 20): number[] => {
  const result: number[] = [];
  const n = values.length;
  const avg = mean(values);

  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += Math.pow(values[i] - avg, 2);
  }
  variance /= n;

  for (let lag = 0; lag <= maxLag; lag++) {
    let covariance = 0;
    for (let i = lag; i < n; i++) {
      covariance += (values[i] - avg) * (values[i - lag] - avg);
    }
    covariance /= n;
    result.push(variance !== 0 ? covariance / variance : 0);
  }

  return result;
};

export const pacf = (values: number[], maxLag: number = 20): number[] => {
  const acfValues = acf(values, maxLag);
  const result: number[] = [1];

  if (acfValues.length < 2) return result;

  const phi: number[][] = [];

  for (let k = 1; k <= maxLag; k++) {
    phi[k] = new Array(k + 1).fill(0);

    if (k === 1) {
      phi[k][k] = acfValues[1];
    } else {
      let numerator = acfValues[k];
      let denominator = 1;

      for (let j = 1; j < k; j++) {
        numerator -= phi[k - 1][j] * acfValues[k - j];
        denominator -= phi[k - 1][j] * acfValues[j];
      }

      phi[k][k] = denominator !== 0 ? numerator / denominator : 0;

      for (let j = 1; j < k; j++) {
        phi[k][j] = phi[k - 1][j] - phi[k][k] * phi[k - 1][k - j];
      }
    }

    result.push(phi[k][k]);
  }

  return result;
};

export const histogram = (values: number[], numBins: number = 20): { bin: string; count: number; frequency: number }[] => {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const binWidth = (max - min) / numBins;

  const bins: { bin: string; count: number; frequency: number }[] = [];

  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    const count = values.filter(v => v >= binStart && (i === numBins - 1 ? v <= binEnd : v < binEnd)).length;

    bins.push({
      bin: `${(binStart * 100).toFixed(1)}%`,
      count,
      frequency: count / values.length,
    });
  }

  return bins;
};
