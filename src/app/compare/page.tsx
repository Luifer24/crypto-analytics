"use client";

import { useState, useMemo } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import { useCryptoComparePriceHistory, isCryptoCompareSupported } from "@/hooks/useCryptoCompareData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { TrendingUp, TrendingDown, Activity, GitMerge, Target, AlertTriangle, FlaskConical, Clock, CheckCircle2, XCircle, Zap } from "lucide-react";

// Import cointegration tests
import {
  adfTest,
  engleGrangerTest,
  calculateHalfLife,
  assessTradingFrequency,
  calculateSpreadZScore,
  generateSignal,
} from "@/lib/cointegration";

// Import Kalman filter
import { useKalmanHedge, analyzeBetaStability } from "@/hooks/useKalmanHedge";

const timeRanges = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "180D", days: 180 },
];

// Calculate rolling mean
const rollingMean = (arr: number[], window: number): number[] => {
  return arr.map((_, idx) => {
    if (idx < window - 1) return NaN;
    const slice = arr.slice(idx - window + 1, idx + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
};

// Calculate rolling standard deviation
const rollingStd = (arr: number[], window: number): number[] => {
  const means = rollingMean(arr, window);
  return arr.map((_, idx) => {
    if (idx < window - 1) return NaN;
    const slice = arr.slice(idx - window + 1, idx + 1);
    const mean = means[idx];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window;
    return Math.sqrt(variance);
  });
};

// Calculate Z-Score
const calculateZScore = (spread: number[], window: number = 20): number[] => {
  const means = rollingMean(spread, window);
  const stds = rollingStd(spread, window);
  return spread.map((val, idx) => {
    if (isNaN(means[idx]) || isNaN(stds[idx]) || stds[idx] === 0) return NaN;
    return (val - means[idx]) / stds[idx];
  });
};

// Calculate rolling correlation
const rollingCorrelation = (arr1: number[], arr2: number[], window: number): number[] => {
  return arr1.map((_, idx) => {
    if (idx < window - 1) return NaN;
    const slice1 = arr1.slice(idx - window + 1, idx + 1);
    const slice2 = arr2.slice(idx - window + 1, idx + 1);

    const mean1 = slice1.reduce((a, b) => a + b, 0) / window;
    const mean2 = slice2.reduce((a, b) => a + b, 0) / window;

    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < window; i++) {
      const d1 = slice1[i] - mean1;
      const d2 = slice2[i] - mean2;
      num += d1 * d2;
      den1 += d1 * d1;
      den2 += d2 * d2;
    }

    const den = Math.sqrt(den1 * den2);
    return den === 0 ? 0 : num / den;
  });
};

// Calculate hedge ratio (beta)
const calculateHedgeRatio = (returns1: number[], returns2: number[]): number => {
  if (returns1.length !== returns2.length || returns1.length < 2) return 1;

  const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
  const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;

  let cov = 0, var2 = 0;
  for (let i = 0; i < returns1.length; i++) {
    cov += (returns1[i] - mean1) * (returns2[i] - mean2);
    var2 += Math.pow(returns2[i] - mean2, 2);
  }

  return var2 === 0 ? 1 : cov / var2;
};

// Calculate returns from prices
const calculateReturns = (prices: number[]): number[] => {
  return prices.slice(1).map((price, i) => (price - prices[i]) / prices[i] * 100);
};

export default function ComparePage() {
  const [asset1, setAsset1] = useState("bitcoin");
  const [asset2, setAsset2] = useState("ethereum");
  const [days, setDays] = useState(90);
  const [spreadType, setSpreadType] = useState<"ratio" | "diff">("ratio");

  const { data: cryptoList } = useCryptoList(50);
  const { data: prices1, isLoading: loading1 } = useCryptoComparePriceHistory(asset1, days);
  const { data: prices2, isLoading: loading2 } = useCryptoComparePriceHistory(asset2, days);

  const supportedCryptos = cryptoList?.filter(c => isCryptoCompareSupported(c.id));
  const crypto1 = cryptoList?.find(c => c.id === asset1);
  const crypto2 = cryptoList?.find(c => c.id === asset2);

  const isLoading = loading1 || loading2;

  // Align price data by timestamp
  const alignedData = useMemo(() => {
    if (!prices1 || !prices2) return null;

    const map1 = new Map(prices1.map(p => [p.timestamp, p.price]));
    const map2 = new Map(prices2.map(p => [p.timestamp, p.price]));

    const commonTimestamps = prices1
      .map(p => p.timestamp)
      .filter(ts => map2.has(ts))
      .sort((a, b) => a - b);

    return commonTimestamps.map(ts => ({
      timestamp: ts,
      price1: map1.get(ts)!,
      price2: map2.get(ts)!,
    }));
  }, [prices1, prices2]);

  // Calculate all metrics
  const analysis = useMemo(() => {
    if (!alignedData || alignedData.length < 30) return null;

    const p1 = alignedData.map(d => d.price1);
    const p2 = alignedData.map(d => d.price2);

    // Normalize prices to start at 100
    const norm1 = p1.map(p => (p / p1[0]) * 100);
    const norm2 = p2.map(p => (p / p2[0]) * 100);

    // ============================================================
    // FORMAL COINTEGRATION TESTS
    // ============================================================

    // Run ADF tests on both price series
    const adf1 = adfTest(p1, { regression: "c", autolag: "aic" });
    const adf2 = adfTest(p2, { regression: "c", autolag: "aic" });

    // Run Engle-Granger cointegration test
    const egTest = engleGrangerTest(p1, p2);

    // Calculate half-life from the cointegrating residuals (spread)
    const halfLifeResult = calculateHalfLife(egTest.residuals);
    const tradingFrequency = assessTradingFrequency(halfLifeResult.halfLife);

    // Use formal hedge ratio from Engle-Granger
    const formalHedgeRatio = egTest.hedgeRatio;
    const formalIntercept = egTest.intercept;

    // The residuals from EG test ARE the stationary spread
    const formalSpread = egTest.residuals;

    // Calculate Z-Score using formal method
    const zScoreResult = calculateSpreadZScore(formalSpread, 20);

    // ============================================================
    // ROLLING CALCULATIONS (for charts)
    // ============================================================

    // Calculate spread (ratio or difference) for visualization
    const displaySpread = spreadType === "ratio"
      ? p1.map((_, i) => p1[i] / p2[i])
      : norm1.map((_, i) => norm1[i] - norm2[i]);

    // Calculate Z-Score of display spread (for backward compatibility)
    const displayZScore = calculateZScore(displaySpread, 20);

    // Calculate rolling correlation
    const returns1 = calculateReturns(p1);
    const returns2 = calculateReturns(p2);
    const correlation = rollingCorrelation(returns1, returns2, 20);

    // Legacy hedge ratio (from returns)
    const legacyHedgeRatio = calculateHedgeRatio(returns1, returns2);

    // Current values
    const currentZScore = zScoreResult.currentZScore;
    const currentCorrelation = correlation[correlation.length - 1];
    const currentSpread = displaySpread[displaySpread.length - 1];
    const meanSpread = displaySpread.filter(s => !isNaN(s)).reduce((a, b) => a + b, 0) / displaySpread.filter(s => !isNaN(s)).length;

    // Generate signal using formal method
    const signalResult = generateSignal(currentZScore, 2, 0);
    const signal: "long_1_short_2" | "short_1_long_2" | "neutral" =
      signalResult.signal === "long_a_short_b" ? "long_1_short_2" :
      signalResult.signal === "short_a_long_b" ? "short_1_long_2" : "neutral";

    return {
      timestamps: alignedData.map(d => d.timestamp),
      norm1,
      norm2,
      spread: displaySpread,
      zScore: displayZScore,
      formalZScore: zScoreResult.zScore,
      correlation: [NaN, ...correlation], // Offset by 1 for returns
      hedgeRatio: formalHedgeRatio, // Use formal hedge ratio
      legacyHedgeRatio,
      intercept: formalIntercept,
      currentZScore,
      currentCorrelation,
      currentSpread,
      meanSpread,
      signal,
      signalStrength: signalResult.strength,
      // Cointegration test results
      cointegration: {
        adf1,
        adf2,
        egTest,
        halfLife: halfLifeResult,
        tradingFrequency,
        isCointegrated: egTest.isCointegrated,
        pValue: egTest.pValue,
      },
    };
  }, [alignedData, spreadType]);

  // Extract price arrays for Kalman filter
  const priceArrays = useMemo(() => {
    if (!alignedData || alignedData.length < 30) return null;
    return {
      p1: alignedData.map(d => d.price1),
      p2: alignedData.map(d => d.price2),
    };
  }, [alignedData]);

  // Run Kalman filter for dynamic hedge ratio
  const kalmanResult = useKalmanHedge(
    priceArrays?.p1 ?? null,
    priceArrays?.p2 ?? null,
    analysis?.hedgeRatio ?? 1,
    analysis?.intercept ?? 0
  );

  // Analyze beta stability
  const betaStability = useMemo(() => {
    if (!kalmanResult.betaHistory.length) return null;
    return analyzeBetaStability(kalmanResult.betaHistory);
  }, [kalmanResult.betaHistory]);

  // Chart data
  const performanceData = useMemo(() => {
    if (!analysis) return [];
    return analysis.timestamps.map((ts, i) => ({
      time: ts,
      [asset1]: analysis.norm1[i],
      [asset2]: analysis.norm2[i],
    }));
  }, [analysis, asset1, asset2]);

  const spreadData = useMemo(() => {
    if (!analysis) return [];
    return analysis.timestamps.map((ts, i) => ({
      time: ts,
      spread: analysis.spread[i],
      mean: analysis.meanSpread,
    }));
  }, [analysis]);

  const zScoreData = useMemo(() => {
    if (!analysis) return [];
    return analysis.timestamps.map((ts, i) => ({
      time: ts,
      zScore: analysis.zScore[i],
    }));
  }, [analysis]);

  const correlationData = useMemo(() => {
    if (!analysis) return [];
    return analysis.timestamps.map((ts, i) => ({
      time: ts,
      correlation: analysis.correlation[i],
    }));
  }, [analysis]);

  // Kalman beta history chart data
  const kalmanBetaData = useMemo(() => {
    if (!analysis || !kalmanResult.betaHistory.length) return [];
    return analysis.timestamps.map((ts, i) => ({
      time: ts,
      staticBeta: analysis.hedgeRatio,
      dynamicBeta: kalmanResult.betaHistory[i] ?? null,
    }));
  }, [analysis, kalmanResult.betaHistory]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text">Pairs Trading Analysis</h1>
          <p className="text-crypto-muted mt-1">
            Statistical arbitrage signals and spread analysis
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select value={asset1} onValueChange={setAsset1}>
            <SelectTrigger className="w-36 bg-crypto-bg border-crypto-border text-crypto-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-border">
              {supportedCryptos?.map((crypto) => (
                <SelectItem key={crypto.id} value={crypto.id} className="text-crypto-text hover:bg-crypto-border">
                  <div className="flex items-center gap-2">
                    <Image src={crypto.image} alt={crypto.name} width={16} height={16} className="rounded-full" />
                    {crypto.symbol.toUpperCase()}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-crypto-muted">/</span>

          <Select value={asset2} onValueChange={setAsset2}>
            <SelectTrigger className="w-36 bg-crypto-bg border-crypto-border text-crypto-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-border">
              {supportedCryptos?.map((crypto) => (
                <SelectItem key={crypto.id} value={crypto.id} className="text-crypto-text hover:bg-crypto-border">
                  <div className="flex items-center gap-2">
                    <Image src={crypto.image} alt={crypto.name} width={16} height={16} className="rounded-full" />
                    {crypto.symbol.toUpperCase()}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 bg-crypto-bg rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded transition-colors",
                  days === range.days
                    ? "bg-crypto-accent text-crypto-bg"
                    : "text-crypto-muted hover:text-crypto-text"
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Signal Card */}
      {analysis && (
        <div className={cn(
          "rounded-lg border p-4",
          analysis.signal === "neutral"
            ? "bg-crypto-card border-crypto-border"
            : analysis.signal === "long_1_short_2"
              ? "bg-green-500/10 border-green-500/30"
              : "bg-red-500/10 border-red-500/30"
        )}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {analysis.signal === "neutral" ? (
                <Activity className="w-6 h-6 text-crypto-muted" />
              ) : (
                <AlertTriangle className={cn(
                  "w-6 h-6",
                  analysis.signal === "long_1_short_2" ? "text-green-500" : "text-red-500"
                )} />
              )}
              <div>
                <p className="font-semibold text-crypto-text">
                  {analysis.signal === "neutral"
                    ? "No Signal - Spread within normal range"
                    : analysis.signal === "long_1_short_2"
                      ? `Long ${crypto1?.symbol.toUpperCase()} / Short ${crypto2?.symbol.toUpperCase()}`
                      : `Short ${crypto1?.symbol.toUpperCase()} / Long ${crypto2?.symbol.toUpperCase()}`
                  }
                </p>
                <p className="text-sm text-crypto-muted">
                  Z-Score: {analysis.currentZScore?.toFixed(2) || "N/A"} |
                  Strength: {analysis.signalStrength}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-crypto-muted">Correlation</p>
                <p className={cn(
                  "font-mono font-semibold",
                  (analysis.currentCorrelation || 0) > 0.7 ? "text-green-500" :
                  (analysis.currentCorrelation || 0) > 0.4 ? "text-yellow-500" : "text-red-500"
                )}>
                  {analysis.currentCorrelation?.toFixed(2) || "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-crypto-muted">Hedge Ratio (β)</p>
                <p className="font-mono font-semibold text-crypto-text">
                  {analysis.hedgeRatio?.toFixed(3) || "N/A"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-crypto-muted">Current Spread</p>
                <p className="font-mono font-semibold text-crypto-text">
                  {spreadType === "ratio"
                    ? analysis.currentSpread?.toFixed(4)
                    : `${analysis.currentSpread?.toFixed(2)}%`
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <Target className="w-4 h-4" />
            Z-Score
          </div>
          <p className={cn(
            "text-2xl font-bold font-mono",
            Math.abs(analysis?.currentZScore || 0) > 2 ? "text-yellow-500" :
            Math.abs(analysis?.currentZScore || 0) > 1 ? "text-crypto-accent" : "text-crypto-text"
          )}>
            {analysis?.currentZScore?.toFixed(2) || "—"}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {Math.abs(analysis?.currentZScore || 0) > 2 ? "Extreme" :
             Math.abs(analysis?.currentZScore || 0) > 1 ? "Elevated" : "Normal"}
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <GitMerge className="w-4 h-4" />
            Correlation (20d)
          </div>
          <p className={cn(
            "text-2xl font-bold font-mono",
            (analysis?.currentCorrelation || 0) > 0.7 ? "text-green-500" :
            (analysis?.currentCorrelation || 0) > 0.4 ? "text-yellow-500" : "text-red-500"
          )}>
            {analysis?.currentCorrelation?.toFixed(2) || "—"}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {(analysis?.currentCorrelation || 0) > 0.7 ? "Strong" :
             (analysis?.currentCorrelation || 0) > 0.4 ? "Moderate" : "Weak"}
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            <Activity className="w-4 h-4" />
            Hedge Ratio (β)
          </div>
          <p className="text-2xl font-bold font-mono text-crypto-text">
            {analysis?.hedgeRatio?.toFixed(3) || "—"}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            1 {crypto1?.symbol.toUpperCase()} = {analysis?.hedgeRatio?.toFixed(3)} {crypto2?.symbol.toUpperCase()}
          </p>
        </div>

        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
            {analysis?.signal === "long_1_short_2" ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : analysis?.signal === "short_1_long_2" ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Activity className="w-4 h-4" />
            )}
            Signal
          </div>
          <p className={cn(
            "text-lg font-bold",
            analysis?.signal === "long_1_short_2" ? "text-green-500" :
            analysis?.signal === "short_1_long_2" ? "text-red-500" : "text-crypto-muted"
          )}>
            {analysis?.signal === "neutral" ? "Neutral" :
             analysis?.signal === "long_1_short_2" ? `Long ${crypto1?.symbol.toUpperCase()}` : `Short ${crypto1?.symbol.toUpperCase()}`}
          </p>
          <p className="text-xs text-crypto-muted mt-1">
            {analysis?.signalStrength || "—"} signal
          </p>
        </div>
      </div>

      {/* Statistical Tests Section */}
      {analysis?.cointegration && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-5 h-5 text-crypto-accent" />
            <h3 className="font-semibold text-crypto-text text-lg">Statistical Tests (Formal)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cointegration Test Result */}
            <div className={cn(
              "rounded-lg border p-4",
              analysis.cointegration.isCointegrated
                ? "bg-green-500/10 border-green-500/30"
                : "bg-red-500/10 border-red-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                {analysis.cointegration.isCointegrated ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-crypto-text">Cointegration</span>
              </div>
              <p className={cn(
                "text-xl font-bold font-mono",
                analysis.cointegration.isCointegrated ? "text-green-500" : "text-red-500"
              )}>
                {analysis.cointegration.isCointegrated ? "YES" : "NO"}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                p-value: {analysis.cointegration.pValue.toFixed(4)}
              </p>
              <p className="text-xs text-crypto-muted">
                ADF: {analysis.cointegration.egTest.statistic.toFixed(3)}
              </p>
            </div>

            {/* Half-Life */}
            <div className={cn(
              "rounded-lg border p-4",
              analysis.cointegration.halfLife.isTradeable
                ? "bg-green-500/10 border-green-500/30"
                : "bg-yellow-500/10 border-yellow-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-crypto-accent" />
                <span className="text-sm font-medium text-crypto-text">Half-Life</span>
              </div>
              <p className="text-xl font-bold font-mono text-crypto-text">
                {isFinite(analysis.cointegration.halfLife.halfLife)
                  ? `${analysis.cointegration.halfLife.halfLife.toFixed(1)} days`
                  : "∞"}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                {analysis.cointegration.tradingFrequency.frequency.replace("_", " ")}
              </p>
              <p className="text-xs text-crypto-muted">
                θ: {analysis.cointegration.halfLife.theta.toFixed(4)}
              </p>
            </div>

            {/* ADF Test Asset 1 */}
            <div className={cn(
              "rounded-lg border p-4",
              !analysis.cointegration.adf1.isStationary
                ? "bg-crypto-bg border-crypto-border"
                : "bg-yellow-500/10 border-yellow-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-crypto-muted" />
                <span className="text-sm font-medium text-crypto-text">
                  ADF {crypto1?.symbol.toUpperCase()}
                </span>
              </div>
              <p className={cn(
                "text-xl font-bold font-mono",
                !analysis.cointegration.adf1.isStationary ? "text-crypto-text" : "text-yellow-500"
              )}>
                {!analysis.cointegration.adf1.isStationary ? "I(1)" : "I(0)"}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                p-value: {analysis.cointegration.adf1.pValue.toFixed(4)}
              </p>
              <p className="text-xs text-crypto-muted">
                stat: {analysis.cointegration.adf1.statistic.toFixed(3)}
              </p>
            </div>

            {/* ADF Test Asset 2 */}
            <div className={cn(
              "rounded-lg border p-4",
              !analysis.cointegration.adf2.isStationary
                ? "bg-crypto-bg border-crypto-border"
                : "bg-yellow-500/10 border-yellow-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-crypto-muted" />
                <span className="text-sm font-medium text-crypto-text">
                  ADF {crypto2?.symbol.toUpperCase()}
                </span>
              </div>
              <p className={cn(
                "text-xl font-bold font-mono",
                !analysis.cointegration.adf2.isStationary ? "text-crypto-text" : "text-yellow-500"
              )}>
                {!analysis.cointegration.adf2.isStationary ? "I(1)" : "I(0)"}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                p-value: {analysis.cointegration.adf2.pValue.toFixed(4)}
              </p>
              <p className="text-xs text-crypto-muted">
                stat: {analysis.cointegration.adf2.statistic.toFixed(3)}
              </p>
            </div>
          </div>

          {/* Trading Frequency Recommendation */}
          <div className="mt-4 p-3 bg-crypto-bg rounded-lg border border-crypto-border">
            <p className="text-sm text-crypto-muted">
              <span className="font-medium text-crypto-text">Trading Assessment:</span>{" "}
              {analysis.cointegration.tradingFrequency.description}.{" "}
              {analysis.cointegration.tradingFrequency.recommendation}
            </p>
          </div>

          {/* Critical Values Reference */}
          {analysis.cointegration.egTest.criticalValues && (
            <div className="mt-4 text-xs text-crypto-muted">
              <p className="font-medium text-crypto-text mb-1">Critical Values (Engle-Granger):</p>
              <p>
                1%: {analysis.cointegration.egTest.criticalValues["1%"]} |
                5%: {analysis.cointegration.egTest.criticalValues["5%"]} |
                10%: {analysis.cointegration.egTest.criticalValues["10%"]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Kalman Filter Section */}
      {analysis && kalmanResult.kalmanResult && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-500" />
            <h3 className="font-semibold text-crypto-text text-lg">Dynamic Hedge Ratio (Kalman Filter)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Static vs Dynamic Beta */}
            <div className="rounded-lg border bg-crypto-bg border-crypto-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-crypto-muted" />
                <span className="text-sm font-medium text-crypto-text">Static β (OLS)</span>
              </div>
              <p className="text-xl font-bold font-mono text-crypto-text">
                {analysis.hedgeRatio.toFixed(4)}
              </p>
              <p className="text-xs text-crypto-muted mt-1">Fixed over time</p>
            </div>

            <div className="rounded-lg border bg-yellow-500/10 border-yellow-500/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-crypto-text">Dynamic β (Kalman)</span>
              </div>
              <p className="text-xl font-bold font-mono text-yellow-500">
                {kalmanResult.dynamicBeta.toFixed(4)}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                {betaStability?.trend === "increasing" ? "↑ Increasing" :
                 betaStability?.trend === "decreasing" ? "↓ Decreasing" : "→ Stable"}
              </p>
            </div>

            {/* Variance Reduction */}
            <div className={cn(
              "rounded-lg border p-4",
              kalmanResult.comparison?.kalmanIsBetter
                ? "bg-green-500/10 border-green-500/30"
                : "bg-crypto-bg border-crypto-border"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-crypto-muted" />
                <span className="text-sm font-medium text-crypto-text">Variance Reduction</span>
              </div>
              <p className={cn(
                "text-xl font-bold font-mono",
                (kalmanResult.comparison?.varianceReduction ?? 0) > 0 ? "text-green-500" : "text-crypto-text"
              )}>
                {kalmanResult.comparison?.varianceReduction.toFixed(1) ?? "—"}%
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                {(kalmanResult.comparison?.varianceReduction ?? 0) > 5 ? "Kalman better" : "Similar"}
              </p>
            </div>

            {/* Beta Stability */}
            <div className={cn(
              "rounded-lg border p-4",
              betaStability?.isStable
                ? "bg-green-500/10 border-green-500/30"
                : "bg-yellow-500/10 border-yellow-500/30"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <GitMerge className="w-4 h-4 text-crypto-muted" />
                <span className="text-sm font-medium text-crypto-text">β Stability</span>
              </div>
              <p className={cn(
                "text-xl font-bold font-mono",
                betaStability?.isStable ? "text-green-500" : "text-yellow-500"
              )}>
                {betaStability?.isStable ? "Stable" : "Volatile"}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                CV: {((betaStability?.cv ?? 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Beta History Chart */}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kalmanBetaData}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length && label) {
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-crypto-muted text-xs mb-1">
                            {format(new Date(label as number), "MMM d, yyyy")}
                          </p>
                          <p className="text-sm text-crypto-muted">
                            Static β: {Number(payload[0]?.value).toFixed(4)}
                          </p>
                          <p className="text-sm text-yellow-500">
                            Dynamic β: {Number(payload[1]?.value).toFixed(4)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="staticBeta"
                  stroke="#64748b"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  name="Static β"
                />
                <Line
                  type="monotone"
                  dataKey="dynamicBeta"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={false}
                  name="Dynamic β"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-crypto-muted mt-2">
            Kalman filter adaptively updates the hedge ratio as market conditions change.
            {kalmanResult.comparison?.kalmanIsBetter
              ? " The dynamic approach shows improvement over static OLS."
              : " Static and dynamic approaches show similar performance."}
          </p>
        </div>
      )}

      {/* Performance Comparison */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-4">
          Normalized Performance (Base 100)
        </h3>
        <div className="h-64">
          {isLoading ? (
            <div className="animate-pulse h-full bg-crypto-border rounded" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length && label) {
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-crypto-muted text-xs mb-2">
                            {format(new Date(label as number), "MMM d, yyyy")}
                          </p>
                          {payload.map((entry, index) => (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                              {String(entry.dataKey).toUpperCase()}: {Number(entry.value).toFixed(2)}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey={asset1} stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={asset2} stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Z-Score Chart */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-crypto-text text-lg">Z-Score of Spread</h3>
            <p className="text-crypto-muted text-sm">Signal zones: ±1σ (yellow), ±2σ (red)</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSpreadType("ratio")}
              className={cn(
                "px-3 py-1 text-sm rounded",
                spreadType === "ratio" ? "bg-crypto-accent text-crypto-bg" : "text-crypto-muted hover:text-crypto-text"
              )}
            >
              Ratio
            </button>
            <button
              onClick={() => setSpreadType("diff")}
              className={cn(
                "px-3 py-1 text-sm rounded",
                spreadType === "diff" ? "bg-crypto-accent text-crypto-bg" : "text-crypto-muted hover:text-crypto-text"
              )}
            >
              Difference
            </button>
          </div>
        </div>
        <div className="h-64">
          {isLoading ? (
            <div className="animate-pulse h-full bg-crypto-border rounded" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={zScoreData}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} domain={[-3, 3]} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload?.length && label) {
                      const zScore = payload[0]?.value as number;
                      return (
                        <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                          <p className="text-crypto-muted text-xs mb-1">
                            {format(new Date(label as number), "MMM d, yyyy")}
                          </p>
                          <p className={cn(
                            "text-sm font-semibold",
                            Math.abs(zScore) > 2 ? "text-red-500" :
                            Math.abs(zScore) > 1 ? "text-yellow-500" : "text-crypto-text"
                          )}>
                            Z-Score: {zScore?.toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={2} stroke="#ef4444" strokeDasharray="5 5" />
                <ReferenceLine y={1} stroke="#eab308" strokeDasharray="3 3" />
                <ReferenceLine y={0} stroke="#64748b" />
                <ReferenceLine y={-1} stroke="#eab308" strokeDasharray="3 3" />
                <ReferenceLine y={-2} stroke="#ef4444" strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="zScore"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Spread and Correlation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spread Chart */}
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text text-lg mb-4">
            Price Spread ({spreadType === "ratio" ? "Ratio" : "Diff %"})
          </h3>
          <div className="h-56">
            {isLoading ? (
              <div className="animate-pulse h-full bg-crypto-border rounded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spreadData}>
                  <XAxis
                    dataKey="time"
                    tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload?.length && label) {
                        return (
                          <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-crypto-muted text-xs mb-1">
                              {format(new Date(label as number), "MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-crypto-text">
                              Spread: {spreadType === "ratio"
                                ? Number(payload[0]?.value).toFixed(4)
                                : `${Number(payload[0]?.value).toFixed(2)}%`
                              }
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={analysis?.meanSpread} stroke="#64748b" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="spread" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Rolling Correlation */}
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
          <h3 className="font-semibold text-crypto-text text-lg mb-4">
            Rolling Correlation (20 days)
          </h3>
          <div className="h-56">
            {isLoading ? (
              <div className="animate-pulse h-full bg-crypto-border rounded" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={correlationData}>
                  <XAxis
                    dataKey="time"
                    tickFormatter={(ts) => format(new Date(ts), "MMM d")}
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} domain={[-1, 1]} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload?.length && label) {
                        const corr = payload[0]?.value as number;
                        return (
                          <div className="bg-crypto-card border border-crypto-border rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-crypto-muted text-xs mb-1">
                              {format(new Date(label as number), "MMM d, yyyy")}
                            </p>
                            <p className={cn(
                              "text-sm font-semibold",
                              corr > 0.7 ? "text-green-500" :
                              corr > 0.4 ? "text-yellow-500" : "text-red-500"
                            )}>
                              Correlation: {corr?.toFixed(3)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0.7} stroke="#22c55e" strokeDasharray="3 3" />
                  <ReferenceLine y={0} stroke="#64748b" />
                  <Line type="monotone" dataKey="correlation" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Trading Rules */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h3 className="font-semibold text-crypto-text text-lg mb-4">Pairs Trading Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="font-semibold text-green-500 mb-2">Entry Long {crypto1?.symbol.toUpperCase()}</p>
            <p className="text-crypto-muted">
              Z-Score &lt; -2 → Long {crypto1?.symbol.toUpperCase()}, Short {analysis?.hedgeRatio?.toFixed(2)} {crypto2?.symbol.toUpperCase()}
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="font-semibold text-red-500 mb-2">Entry Short {crypto1?.symbol.toUpperCase()}</p>
            <p className="text-crypto-muted">
              Z-Score &gt; 2 → Short {crypto1?.symbol.toUpperCase()}, Long {analysis?.hedgeRatio?.toFixed(2)} {crypto2?.symbol.toUpperCase()}
            </p>
          </div>
          <div className="bg-crypto-bg border border-crypto-border rounded-lg p-4">
            <p className="font-semibold text-crypto-text mb-2">Exit Position</p>
            <p className="text-crypto-muted">
              Z-Score returns to 0 (mean reversion) or crosses ±3 (stop loss)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
