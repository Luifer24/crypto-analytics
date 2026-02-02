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

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Zap, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { usePythonBacktest, convertConfigToPython } from '@/hooks/usePythonBacktest';
import { useFuturesSymbols } from '@/hooks/useFuturesData';
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
          lookbackHours,
        }),
      });
    } catch (err) {
      console.error('[Backtest2] Error loading data:', err);
      alert(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Backtest 2.0
            <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-blue-500">
              <Zap className="w-3 h-3 mr-1" />
              Python Powered
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-2">
            Professional backtesting with statsmodels • Time-based lookback • 10-100x faster
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Symbol 1 */}
            <div>
              <label className="text-sm font-medium">Asset 1</label>
              <select
                value={symbol1}
                onChange={(e) => setSymbol1(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
                disabled={isLoadingSymbols}
              >
                {availableSymbols.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Symbol 2 */}
            <div>
              <label className="text-sm font-medium">Asset 2</label>
              <select
                value={symbol2}
                onChange={(e) => setSymbol2(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
                disabled={isLoadingSymbols}
              >
                {availableSymbols.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Interval */}
            <div>
              <label className="text-sm font-medium">Interval</label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              >
                <option value="5m">5 min</option>
                <option value="15m">15 min</option>
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="1d">1 day</option>
              </select>
            </div>

            {/* Lookback Days */}
            <div>
              <label className="text-sm font-medium">Lookback Days</label>
              <input
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(Number(e.target.value))}
                className="w-full mt-1 p-2 border rounded"
                min={7}
                max={365}
              />
            </div>

            {/* Lookback Hours */}
            <div>
              <label className="text-sm font-medium">Rolling Window (hours)</label>
              <input
                type="number"
                value={lookbackHours}
                onChange={(e) => setLookbackHours(Number(e.target.value))}
                className="w-full mt-1 p-2 border rounded"
                min={1}
                max={168}
                step={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Window for calculating Z-Score mean/std
              </p>
            </div>

            {/* Run Button */}
            <div className="flex items-end">
              <Button
                onClick={handleRunBacktest}
                disabled={isLoadingSymbols || isRunning || availableSymbols.length === 0}
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Backtest
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Strategy Parameters */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-semibold mb-4">Strategy Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Entry Threshold */}
              <div>
                <label className="text-sm font-medium">Entry Z-Score</label>
                <input
                  type="number"
                  value={entryThreshold}
                  onChange={(e) => setEntryThreshold(Number(e.target.value))}
                  className="w-full mt-1 p-2 border rounded"
                  min={0.5}
                  max={5}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter trade when |Z| exceeds this
                </p>
              </div>

              {/* Exit Threshold */}
              <div>
                <label className="text-sm font-medium">Exit Z-Score</label>
                <input
                  type="number"
                  value={exitThreshold}
                  onChange={(e) => setExitThreshold(Number(e.target.value))}
                  className="w-full mt-1 p-2 border rounded"
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Exit when Z-score crosses this (mean reversion)
                </p>
              </div>

              {/* Stop Loss */}
              <div>
                <label className="text-sm font-medium">Stop Loss Z-Score</label>
                <input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="w-full mt-1 p-2 border rounded"
                  min={1}
                  max={10}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Exit if Z-score exceeds this (stop loss)
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
              <strong>Error:</strong> {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && priceData && (
        <>
          {/* Metrics Row - Full Width */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Return</p>
                    <p className={`text-2xl font-bold ${result.metrics.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(result.metrics.total_return * 100).toFixed(2)}%
                    </p>
                  </div>
                  {result.metrics.total_return >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                    <p className="text-2xl font-bold">{result.metrics.sharpe.toFixed(2)}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Trades</p>
                  <p className="text-2xl font-bold">{result.metrics.total_trades}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Win Rate: {(result.metrics.win_rate * 100).toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    {(result.metrics.max_drawdown * 100).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Profit Factor: {result.metrics.profit_factor.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Two-Column Layout: Equity Curve (left) + Price & Z-Score (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Equity Curve */}
            <Card>
              <CardHeader>
                <CardTitle>Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
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
                      />
                      <YAxis
                        label={{ value: '%PnL', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const pnl = payload[0].value as number;
                            const timestamp = payload[0].payload.timestamp;
                            return (
                              <div className="bg-background border rounded p-2 shadow-lg text-xs">
                                <p className="font-semibold">{formatTimestamp(timestamp, interval)}</p>
                                <p className={pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  PnL: {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" label={{ value: 'Break-even', fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={false}
                        fill="url(#equityGradient)"
                      />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Right: Price + Z-Score Charts */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Asset Prices & Signals</span>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        {symbol1}
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        {symbol2}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10 }}
                          label={{ value: symbol1, angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10 }}
                          label={{ value: symbol2, angle: 90, position: 'insideRight', style: { fontSize: 10 } }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const timestamp = payload[0].payload.timestamp;
                              return (
                                <div className="bg-background border rounded p-2 shadow-lg text-xs">
                                  <p className="font-semibold">{formatTimestamp(timestamp, interval)}</p>
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Z-Score</CardTitle>
                </CardHeader>
                <CardContent>
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
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            domain={[-4, 4]}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const timestamp = payload[0].payload.timestamp;
                                return (
                                  <div className="bg-background border rounded p-2 shadow-lg text-xs">
                                    <p className="font-semibold">{formatTimestamp(timestamp, interval)}</p>
                                    <p>Z-Score: {payload[0].value?.toFixed(3)}</p>
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
                        <p className="text-sm text-muted-foreground">Run backtest to see Z-Score</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Detailed Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Annualized Return</p>
                  <p className="font-semibold">{(result.metrics.annualized_return * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sortino Ratio</p>
                  <p className="font-semibold">{result.metrics.sortino.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Trade PnL</p>
                  <p className="font-semibold">{(result.metrics.avg_trade_pnl * 100).toFixed(3)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Holding (bars)</p>
                  <p className="font-semibold">{result.metrics.avg_holding_period.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Winning Trades</p>
                  <p className="font-semibold text-green-600">{result.metrics.winning_trades}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Losing Trades</p>
                  <p className="font-semibold text-red-600">{result.metrics.losing_trades}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Execution Time</p>
                  <p className="font-semibold">{result.execution_time_ms.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Engine</p>
                  <p className="font-semibold text-purple-600">Python + statsmodels</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trades Table */}
          <Card>
            <CardHeader>
              <CardTitle>Trade History ({result.trades.length} trades)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Side</th>
                      <th className="text-right p-2">Entry Z</th>
                      <th className="text-right p-2">Exit Z</th>
                      <th className="text-right p-2">PnL</th>
                      <th className="text-right p-2">Holding</th>
                      <th className="text-left p-2">Exit Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 50).map((trade, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50">
                        <td className="p-2">{i + 1}</td>
                        <td className="p-2">
                          <Badge variant={trade.side === 'long_spread' ? 'default' : 'secondary'}>
                            {trade.side === 'long_spread' ? 'Long' : 'Short'}
                          </Badge>
                        </td>
                        <td className="text-right p-2">{trade.entry_z_score.toFixed(2)}</td>
                        <td className="text-right p-2">{trade.exit_z_score.toFixed(2)}</td>
                        <td className={`text-right p-2 font-semibold ${trade.pnl_net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {(trade.pnl_net * 100).toFixed(2)}%
                        </td>
                        <td className="text-right p-2">{trade.holding_period}</td>
                        <td className="p-2 text-xs">{trade.exit_reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.trades.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Showing first 50 of {result.trades.length} trades
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Info Banner */}
      {!result && !isRunning && (
        <Card className="border-purple-200/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-3 text-purple-700 dark:text-purple-400">
              Python-Powered Professional Backtesting
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                <span><strong>Time-based lookback:</strong> Consistent 24h window across all intervals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                <span><strong>statsmodels integration:</strong> Professional Engle-Granger cointegration test</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                <span><strong>Proper annualization:</strong> Correct Sharpe ratio for all intervals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                <span><strong>Vectorized operations:</strong> 10-100x speed improvement with pandas/numpy</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                <span><strong>Type-safe:</strong> Python dataclasses for reliability</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
