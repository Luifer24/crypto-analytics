"use client";

/**
 * Backtest 2.0 - Python-Powered Professional Backtesting
 *
 * This page uses the Python FastAPI backend with statsmodels for:
 * - Professional Engle-Granger cointegration test
 * - Time-based lookback (fixes interval bug)
 * - Proper annualization for all intervals
 * - Vectorized operations (10-100x faster)
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Play, Zap, TrendingUp, TrendingDown, BarChart3, Target, Percent, Clock } from 'lucide-react';
import { usePythonBacktest, convertConfigToPython } from '@/hooks/usePythonBacktest';
import { useFuturesSymbols } from '@/hooks/useFuturesData';
import { cn } from '@/lib/utils';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// ============================================================================
// Components
// ============================================================================

/**
 * Reusable metric card component
 */
function MetricCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
      <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <p className={cn("text-xl font-bold", valueClass || "text-crypto-text")}>
        {value}
      </p>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format timestamp for chart display based on interval
 */
function formatTimestamp(timestamp: number, interval: string): string {
  const date = new Date(timestamp);

  if (interval === '1d') {
    // Daily: show MM/DD
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  } else {
    // Intraday: show MM/DD HH:mm
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

interface FuturesPriceData {
  t: number;  // timestamp
  i: string;  // interval
  c: number;  // close price
}

async function fetchFuturesPrices(
  symbol: string,
  lookbackDays: number,
  interval: string
): Promise<{ prices: number[]; timestamps: number[] }> {
  const res = await fetch(`/data/futures/prices/${symbol}USDT.json`);
  if (!res.ok) throw new Error(`Failed to fetch data for ${symbol}`);

  const data = await res.json();
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  // Filter by interval and time
  const filtered: FuturesPriceData[] = data.data.filter(
    (p: FuturesPriceData) => p.t >= cutoff && p.i === interval
  );

  // Sort by timestamp
  const sorted = filtered.sort((a, b) => a.t - b.t);

  return {
    prices: sorted.map((p) => p.c),
    timestamps: sorted.map((p) => p.t),
  };
}

export default function Backtest2Page() {
  // Get available symbols
  const { data, isLoading: isLoadingSymbols } = useFuturesSymbols();
  const availableSymbols = data?.symbols.map(s => s.baseAsset) || []; // Extract base assets (BTC, ETH, etc.)

  // Python backtest hook
  const { runBacktest, isLoading: isRunning, error, result } = usePythonBacktest();

  // State
  const [symbol1, setSymbol1] = useState('FIL');
  const [symbol2, setSymbol2] = useState('ICP');
  const [interval, setInterval] = useState('15m');
  const [lookbackDays, setLookbackDays] = useState(90);
  const [lookbackHours, setLookbackHours] = useState(24);

  // Hedge ratio configuration
  const [useRollingHedge, setUseRollingHedge] = useState(false);
  const [hedgeRatioLookbackDays, setHedgeRatioLookbackDays] = useState(30);

  // Strategy parameters
  const [entryThreshold, setEntryThreshold] = useState(2.0);
  const [exitThreshold, setExitThreshold] = useState(0.0);
  const [stopLoss, setStopLoss] = useState(3.0);

  // Price data for charts
  const [priceData, setPriceData] = useState<{
    prices1: number[];
    prices2: number[];
    timestamps: number[];
  } | null>(null);

  // Calculate Z-Score series
  const zScoreData = useMemo(() => {
    if (!priceData || !result) return null;

    const { hedge_ratio, intercept } = result;
    const { prices1, prices2 } = priceData;

    // Calculate spread series
    const spread = prices1.map((p1, i) => p1 - intercept - hedge_ratio * prices2[i]);

    // Calculate rolling Z-Score (using lookbackHours)
    const lookbackBars = Math.floor((lookbackHours * 60) / parseInt(interval.replace(/[^\d]/g, '')));
    const zScores: number[] = [];

    for (let i = 0; i < spread.length; i++) {
      const startIdx = Math.max(0, i - lookbackBars + 1);
      const window = spread.slice(startIdx, i + 1);

      const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (window.length - 1);
      const std = Math.sqrt(variance);

      const z = std > 0 ? (spread[i] - mean) / std : 0;
      zScores.push(z);
    }

    return zScores.map((z, index) => ({
      timestamp: priceData.timestamps[index],
      zScore: z
    }));
  }, [priceData, result, lookbackHours, interval]);

  // Handle backtest run
  const handleRunBacktest = async () => {
    try {
      // Fetch data for both symbols
      const [data1, data2] = await Promise.all([
        fetchFuturesPrices(symbol1, lookbackDays, interval),
        fetchFuturesPrices(symbol2, lookbackDays, interval),
      ]);

      // Align data by timestamps (keep only common timestamps)
      const timestamps1Set = new Set(data1.timestamps);
      const commonIndices2 = data2.timestamps.map((t, i) => timestamps1Set.has(t) ? i : -1).filter(i => i !== -1);
      const commonIndices1 = data1.timestamps.map((t, i) => new Set(data2.timestamps).has(t) ? i : -1).filter(i => i !== -1);

      const alignedPrices1 = commonIndices1.map(i => data1.prices[i]);
      const alignedPrices2 = commonIndices2.map(i => data2.prices[i]);
      const alignedTimestamps = commonIndices1.map(i => data1.timestamps[i]);

      console.log('[Backtest2] Data loaded:', {
        symbol1,
        symbol2,
        interval,
        lookbackDays,
        data1Points: data1.prices.length,
        data2Points: data2.prices.length,
        alignedPoints: alignedPrices1.length,
        lookbackHours,
      });

      if (alignedPrices1.length < 30) {
        alert(
          `Insufficient aligned data points: ${alignedPrices1.length} found (need at least 30).\n\n` +
          `${symbol1}: ${data1.prices.length} points\n` +
          `${symbol2}: ${data2.prices.length} points\n\n` +
          `Try: Reduce lookback days, change interval to 1h or 4h, or select different assets with more data.`
        );
        return;
      }

      // Store price data for charts
      setPriceData({
        prices1: alignedPrices1,
        prices2: alignedPrices2,
        timestamps: alignedTimestamps,
      });

      // Run Python backtest
      await runBacktest({
        symbol1,
        symbol2,
        prices1: alignedPrices1,
        prices2: alignedPrices2,
        timestamps: alignedTimestamps,
        lookbackDays,
        interval,
        config: convertConfigToPython({
          entryThreshold,
          exitThreshold,
          stopLoss,
          useRollingHedge,
          hedgeRatioLookbackDays,
          hedgeRecalcIntervalHours: 24.0, // Daily recalculation for rolling hedge
          lookbackHours,
        }),
      });
    } catch (err) {
      console.error('[Backtest2] Error loading data:', err);
      alert(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-3">
            <Zap className="w-6 h-6 text-crypto-accent" />
            Backtest
            <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-blue-500">
              Python Powered
            </Badge>
          </h1>
          <p className="text-crypto-muted mt-1">
            Professional backtesting with statsmodels • Time-based lookback • 10-100x faster
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h2 className="text-lg font-semibold text-crypto-text mb-4">Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* === PAIR & INTERVAL === */}
          <div className="col-span-full">
            <h3 className="text-sm font-semibold text-crypto-accent mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Pair & Interval
            </h3>
          </div>

          {/* Asset 1 */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Asset 1</label>
            <Select value={symbol1} onValueChange={setSymbol1} disabled={isLoadingSymbols}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                {availableSymbols.map((s) => (
                  <SelectItem key={s} value={s} className="text-crypto-text">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asset 2 */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Asset 2</label>
            <Select value={symbol2} onValueChange={setSymbol2} disabled={isLoadingSymbols}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                {availableSymbols.map((s) => (
                  <SelectItem key={s} value={s} className="text-crypto-text">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Interval</label>
            <Select value={interval} onValueChange={setInterval}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                <SelectItem value="5m" className="text-crypto-text">5 min</SelectItem>
                <SelectItem value="15m" className="text-crypto-text">15 min</SelectItem>
                <SelectItem value="1h" className="text-crypto-text">1 hour</SelectItem>
                <SelectItem value="4h" className="text-crypto-text">4 hours</SelectItem>
                <SelectItem value="1d" className="text-crypto-text">1 day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* === LOOKBACK & DATA === */}
          <div className="col-span-full border-t border-crypto-border pt-6 mt-2">
            <h3 className="text-sm font-semibold text-crypto-accent mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Lookback & Data Parameters
            </h3>
          </div>

          {/* Hedge Ratio Period */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Hedge Ratio Period (days)</label>
            <Input
              type="number"
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              className="bg-crypto-bg border-crypto-border text-crypto-text"
              min={7}
              max={365}
            />
            <p className="text-xs text-crypto-muted mt-1">
              Historical data for static hedge ratio (Engle-Granger)
            </p>
          </div>

          {/* Z-Score Lookback */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">
              Z-Score Lookback (hours)
            </label>
            <Input
              type="number"
              value={lookbackHours}
              onChange={(e) => setLookbackHours(Number(e.target.value))}
              className="bg-crypto-bg border-crypto-border text-crypto-text"
              min={1}
              max={168}
              step={1}
            />
            <p className="text-xs text-crypto-muted mt-1">
              Rolling window for Z-Score normalization
            </p>
          </div>

          {/* Use Rolling Hedge Ratio */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rolling-hedge"
              checked={useRollingHedge}
              onCheckedChange={(checked) => setUseRollingHedge(checked as boolean)}
            />
            <label
              htmlFor="rolling-hedge"
              className="text-sm text-crypto-text cursor-pointer"
            >
              Use Rolling Hedge Ratio
            </label>
          </div>

          {/* Hedge Ratio Lookback (only shown when rolling hedge is enabled) */}
          {useRollingHedge && (
            <div>
              <label className="text-sm text-crypto-muted mb-2 block">
                Hedge Ratio Lookback (days)
              </label>
              <Input
                type="number"
                value={hedgeRatioLookbackDays}
                onChange={(e) => setHedgeRatioLookbackDays(Number(e.target.value))}
                className="bg-crypto-bg border-crypto-border text-crypto-text"
                min={7}
                max={365}
              />
              <p className="text-xs text-crypto-muted mt-1">
                Rolling window for dynamic hedge ratio (β recalculated daily)
              </p>
            </div>
          )}

          {/* === TRADING STRATEGY === */}
          <div className="col-span-full border-t border-crypto-border pt-6 mt-2">
            <h3 className="text-sm font-semibold text-crypto-accent mb-3 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Trading Strategy
            </h3>
          </div>

          {/* Entry Threshold */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Entry Z-Score</label>
            <Input
              type="number"
              value={entryThreshold}
              onChange={(e) => setEntryThreshold(Number(e.target.value))}
              className="bg-crypto-bg border-crypto-border text-crypto-text"
              min={0.5}
              max={5}
              step={0.1}
            />
            <p className="text-xs text-crypto-muted mt-1">
              Enter trade when |Z| exceeds this
            </p>
          </div>

          {/* Exit Threshold */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Exit Z-Score</label>
            <Input
              type="number"
              value={exitThreshold}
              onChange={(e) => setExitThreshold(Number(e.target.value))}
              className="bg-crypto-bg border-crypto-border text-crypto-text"
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-xs text-crypto-muted mt-1">
              Exit when Z-score crosses this (mean reversion)
            </p>
          </div>

          {/* Stop Loss */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Stop Loss Z-Score</label>
            <Input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="bg-crypto-bg border-crypto-border text-crypto-text"
              min={1}
              max={10}
              step={0.1}
            />
            <p className="text-xs text-crypto-muted mt-1">
              Exit if Z-score exceeds this (stop loss)
            </p>
          </div>
        </div>

        {/* Run Button */}
        <div className="mt-6">
          <button
            onClick={handleRunBacktest}
            disabled={isRunning || isLoadingSymbols || availableSymbols.length === 0}
            className={cn(
              "px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              isRunning || isLoadingSymbols || availableSymbols.length === 0
                ? "bg-crypto-muted/20 text-crypto-muted cursor-not-allowed"
                : "bg-crypto-accent text-white hover:bg-crypto-accent/80"
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Backtest
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <p className="text-red-500">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && priceData && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              icon={TrendingUp}
              label="Total Return"
              value={`${(result.metrics.total_return * 100).toFixed(2)}%`}
              valueClass={result.metrics.total_return >= 0 ? "text-green-500" : "text-red-500"}
            />
            <MetricCard
              icon={BarChart3}
              label="Sharpe Ratio"
              value={result.metrics.sharpe.toFixed(2)}
              valueClass={result.metrics.sharpe >= 1 ? "text-green-500" : "text-crypto-text"}
            />
            <MetricCard
              icon={TrendingDown}
              label="Max Drawdown"
              value={`-${(Math.abs(result.metrics.max_drawdown) * 100).toFixed(2)}%`}
              valueClass="text-red-500"
            />
            <MetricCard
              icon={Percent}
              label="Win Rate"
              value={`${(result.metrics.win_rate * 100).toFixed(1)}%`}
              valueClass={result.metrics.win_rate >= 0.5 ? "text-green-500" : "text-crypto-text"}
            />
            <MetricCard
              icon={Target}
              label="Profit Factor"
              value={result.metrics.profit_factor.toFixed(2)}
              valueClass={result.metrics.profit_factor >= 1.5 ? "text-green-500" : "text-crypto-text"}
            />
            <MetricCard
              icon={Clock}
              label="Total Trades"
              value={result.metrics.total_trades.toString()}
            />
          </div>

          {/* Two-Column Layout: Equity Curve (left) + Price & Z-Score (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Equity Curve */}
            <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
              <h3 className="text-lg font-semibold text-crypto-text mb-4">Equity Curve</h3>
              <div className="h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart
                    data={result.equity_curve.map((value, index) => ({
                      timestamp: priceData.timestamps[index],
                      pnl: (value - 1) * 100, // Convert to %PnL: 1.0 → 0%, 1.2 → 20%, 0.9 → -10%
                    }))}
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="equityGradientNegative" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(ts) => formatTimestamp(ts, interval)}
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      stroke="#6b7280"
                    />
                    <YAxis
                      label={{ value: '%PnL', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 10 }}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a2e",
                        border: "1px solid #2d2d44",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#9ca3af" }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const pnl = payload[0].value as number;
                          const timestamp = payload[0].payload.timestamp;
                          return (
                            <div className="bg-crypto-card border border-crypto-border rounded p-2 shadow-lg text-xs">
                              <p className="font-semibold text-crypto-muted">{formatTimestamp(timestamp, interval)}</p>
                              <p className={pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                PnL: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" label={{ value: 'Break-even', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="pnl"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Price + Z-Score Charts */}
            <div className="space-y-6">
              <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-crypto-text">Asset Prices & Signals</h3>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-crypto-muted">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      {symbol1}
                    </span>
                    <span className="flex items-center gap-1 text-crypto-muted">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      {symbol2}
                    </span>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={priceData.prices1.map((price1, index) => ({
                        index,
                        timestamp: priceData.timestamps[index],
                        price1: price1,
                        price2: priceData.prices2[index],
                      }))}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => formatTimestamp(ts, interval)}
                        tick={{ fontSize: 9 }}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                        stroke="#6b7280"
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        label={{ value: symbol1, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                        label={{ value: symbol2, angle: 90, position: 'insideRight', style: { fontSize: 10 } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1a2e",
                          border: "1px solid #2d2d44",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#9ca3af" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const timestamp = payload[0].payload.timestamp;
                            return (
                              <div className="bg-crypto-card border border-crypto-border rounded p-2 shadow-lg text-xs">
                                <p className="font-semibold text-crypto-muted">{formatTimestamp(timestamp, interval)}</p>
                                <p className="text-blue-500">{symbol1}: ${payload[0].value?.toFixed(4)}</p>
                                <p className="text-green-500">{symbol2}: ${payload[1]?.value?.toFixed(4)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="price1"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        dot={false}
                        name={symbol1}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="price2"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                        name={symbol2}
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
                <h3 className="text-lg font-semibold text-crypto-text mb-4">Z-Score</h3>
                <div className="h-64">
                  {zScoreData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart
                        data={zScoreData}
                        margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                      >
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={(ts) => formatTimestamp(ts, interval)}
                          tick={{ fontSize: 9 }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                          stroke="#6b7280"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="#6b7280"
                          domain={[-4, 4]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a1a2e",
                            border: "1px solid #2d2d44",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#9ca3af" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const timestamp = payload[0].payload.timestamp;
                              return (
                                <div className="bg-crypto-card border border-crypto-border rounded p-2 shadow-lg text-xs">
                                  <p className="font-semibold text-crypto-muted">{formatTimestamp(timestamp, interval)}</p>
                                  <p className="text-crypto-text">Z-Score: {payload[0].value?.toFixed(3)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {/* Entry thresholds */}
                        <ReferenceLine y={entryThreshold} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `+${entryThreshold}`, fontSize: 10, fill: '#ef4444' }} />
                        <ReferenceLine y={-entryThreshold} stroke="#ef4444" strokeDasharray="3 3" label={{ value: `-${entryThreshold}`, fontSize: 10, fill: '#ef4444' }} />
                        {/* Exit threshold */}
                        <ReferenceLine y={exitThreshold} stroke="#10b981" strokeDasharray="3 3" label={{ value: `${exitThreshold}`, fontSize: 10, fill: '#10b981' }} />
                        {/* Stop loss */}
                        <ReferenceLine y={stopLoss} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `+${stopLoss}`, fontSize: 10, fill: '#f59e0b' }} />
                        <ReferenceLine y={-stopLoss} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: `-${stopLoss}`, fontSize: 10, fill: '#f59e0b' }} />
                        <Line
                          type="monotone"
                          dataKey="zScore"
                          stroke="#8b5cf6"
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-crypto-muted">Run backtest to see Z-Score</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
            <h3 className="text-lg font-semibold text-crypto-text mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-crypto-muted">Annualized Return</p>
                <p className="font-semibold text-crypto-text">{(result.metrics.annualized_return * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Sortino Ratio</p>
                <p className="font-semibold text-crypto-text">{result.metrics.sortino.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Avg Trade PnL</p>
                <p className="font-semibold text-crypto-text">{(result.metrics.avg_trade_pnl * 100).toFixed(3)}%</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Avg Holding (bars)</p>
                <p className="font-semibold text-crypto-text">{result.metrics.avg_holding_period.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Winning Trades</p>
                <p className="font-semibold text-green-500">{result.metrics.winning_trades}</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Losing Trades</p>
                <p className="font-semibold text-red-500">{result.metrics.losing_trades}</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Execution Time</p>
                <p className="font-semibold text-crypto-text">{result.execution_time_ms.toFixed(0)}ms</p>
              </div>
              <div>
                <p className="text-sm text-crypto-muted">Engine</p>
                <p className="font-semibold text-purple-500">Python + statsmodels</p>
              </div>
            </div>
          </div>

          {/* Trades Table */}
          <div className="bg-crypto-card rounded-lg border border-crypto-border overflow-hidden">
            <div className="p-4 border-b border-crypto-border">
              <h3 className="text-lg font-semibold text-crypto-text">
                Trade History ({result.trades.length} trades)
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-crypto-border hover:bg-transparent">
                  <TableHead className="text-crypto-muted">#</TableHead>
                  <TableHead className="text-crypto-muted">Side</TableHead>
                  <TableHead className="text-crypto-muted text-right">Entry Z</TableHead>
                  <TableHead className="text-crypto-muted text-right">Exit Z</TableHead>
                  <TableHead className="text-crypto-muted text-right">PnL</TableHead>
                  <TableHead className="text-crypto-muted text-right">Holding</TableHead>
                  <TableHead className="text-crypto-muted">Exit Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.trades.slice(0, 50).map((trade, i) => (
                  <TableRow key={i} className="border-crypto-border">
                    <TableCell className="text-crypto-muted">{i + 1}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 text-xs rounded",
                        trade.side === "long_spread"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      )}>
                        {trade.side === "long_spread" ? "Long" : "Short"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-crypto-text">{trade.entry_z_score.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-crypto-text">{trade.exit_z_score.toFixed(2)}</TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold", trade.pnl_net >= 0 ? "text-green-500" : "text-red-500")}>
                      {(trade.pnl_net * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-crypto-text">{trade.holding_period}</TableCell>
                    <TableCell className="text-crypto-muted capitalize text-xs">{trade.exit_reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {result.trades.length > 50 && (
              <div className="p-4 text-center text-crypto-muted text-sm border-t border-crypto-border">
                Showing first 50 of {result.trades.length} trades
              </div>
            )}
          </div>
        </>
      )}

      {/* Info Banner */}
      {!result && !isRunning && (
        <div className="bg-crypto-card rounded-lg border border-purple-500/30 p-6">
          <h3 className="font-semibold mb-3 text-purple-400">
            Python-Powered Professional Backtesting
          </h3>
          <ul className="space-y-2 text-sm text-crypto-muted">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">•</span>
              <span><strong className="text-crypto-text">Time-based lookback:</strong> Consistent 24h window across all intervals</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">•</span>
              <span><strong className="text-crypto-text">statsmodels integration:</strong> Professional Engle-Granger cointegration test</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">•</span>
              <span><strong className="text-crypto-text">Proper annualization:</strong> Correct Sharpe ratio for all intervals</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">•</span>
              <span><strong className="text-crypto-text">Vectorized operations:</strong> 10-100x speed improvement with pandas/numpy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">•</span>
              <span><strong className="text-crypto-text">Type-safe:</strong> Python dataclasses for reliability</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
