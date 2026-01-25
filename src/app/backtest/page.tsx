"use client";

import { useState, useMemo } from "react";
import { useBacktest, formatTrade, type DataSource } from "@/hooks/useBacktest";
import type { BacktestConfig } from "@/types/arbitrage";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart as LineChartIcon,
  Play,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Percent,
  Clock,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ============================================================================
// Constants
// ============================================================================

const SYMBOLS = [
  "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT", "LINK", "AVAX",
  "MATIC", "LTC", "UNI", "ATOM", "ETC", "FIL", "APT", "ARB", "OP", "NEAR",
];

const LOOKBACK_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
  { label: "365 Days", value: 365 },
];

const INTERVAL_OPTIONS = [
  { label: "5 min", value: "5m" },
  { label: "15 min", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "1 day", value: "1d" },
];

// ============================================================================
// Components
// ============================================================================

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
// Main Component
// ============================================================================

export default function BacktestPage() {
  // Form state
  const [symbol1, setSymbol1] = useState("BTC");
  const [symbol2, setSymbol2] = useState("ETH");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [dataSource, setDataSource] = useState<DataSource>("futures");
  const [interval, setInterval] = useState<"5m" | "15m" | "1h" | "4h" | "1d">("1d");

  // Config state
  const [entryThreshold, setEntryThreshold] = useState(2.0);
  const [exitThreshold, setExitThreshold] = useState(0.0);
  const [stopLoss, setStopLoss] = useState(3.0);
  const [useDynamicHedge, setUseDynamicHedge] = useState(false);

  // Backtest hook
  const {
    isLoading,
    error,
    result,
    runBacktest,
  } = useBacktest();

  // Handle run
  const handleRun = () => {
    const config: Partial<BacktestConfig> = {
      entryThreshold,
      exitThreshold,
      stopLoss,
      useDynamicHedge,
    };

    runBacktest(
      {
        symbol1,
        symbol2,
        lookbackDays,
        dataSource,
        interval,
      },
      config
    );
  };

  // Prepare equity chart data
  const equityChartData = useMemo(() => {
    if (!result) return [];
    return result.equity.map((value, index) => ({
      bar: index,
      equity: value,
    }));
  }, [result]);

  // Format trades for display
  const formattedTrades = useMemo(() => {
    if (!result) return [];
    return result.trades.map((trade, index) => formatTrade(trade, index));
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-crypto-accent" />
            Backtest
          </h1>
          <p className="text-crypto-muted mt-1">
            Test pairs trading strategies on historical data
          </p>
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
        <h2 className="text-lg font-semibold text-crypto-text mb-4">Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data Source Toggle */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Data Source</label>
            <div className="flex rounded-lg border border-crypto-border overflow-hidden">
              <button
                onClick={() => setDataSource("spot")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors",
                  dataSource === "spot"
                    ? "bg-crypto-accent text-white"
                    : "bg-crypto-bg text-crypto-muted hover:text-crypto-text"
                )}
              >
                <LineChartIcon className="w-4 h-4" />
                Spot
              </button>
              <button
                onClick={() => setDataSource("futures")}
                className={cn(
                  "flex-1 px-3 py-2 text-sm flex items-center justify-center gap-1.5 transition-colors",
                  dataSource === "futures"
                    ? "bg-crypto-accent text-white"
                    : "bg-crypto-bg text-crypto-muted hover:text-crypto-text"
                )}
              >
                <Wallet className="w-4 h-4" />
                Futures
              </button>
            </div>
          </div>

          {/* Asset 1 */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Asset 1</label>
            <Select value={symbol1} onValueChange={setSymbol1}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                {SYMBOLS.map((s) => (
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
            <Select value={symbol2} onValueChange={setSymbol2}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                {SYMBOLS.filter(s => s !== symbol1).map((s) => (
                  <SelectItem key={s} value={s} className="text-crypto-text">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lookback */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Lookback</label>
            <Select value={String(lookbackDays)} onValueChange={(v) => setLookbackDays(Number(v))}>
              <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                {LOOKBACK_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)} className="text-crypto-text">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Interval (futures only) */}
          {dataSource === "futures" && (
            <div>
              <label className="text-sm text-crypto-muted mb-2 block">Interval</label>
              <Select value={interval} onValueChange={(v) => setInterval(v as typeof interval)}>
                <SelectTrigger className="bg-crypto-bg border-crypto-border text-crypto-text">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-crypto-card border-crypto-border">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-crypto-text">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entry Threshold */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Entry Z-Score</label>
            <input
              type="number"
              value={entryThreshold}
              onChange={(e) => setEntryThreshold(Number(e.target.value))}
              step={0.1}
              min={0.5}
              max={4}
              className="w-full px-3 py-2 bg-crypto-bg border border-crypto-border rounded-md text-crypto-text"
            />
          </div>

          {/* Exit Threshold */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Exit Z-Score</label>
            <input
              type="number"
              value={exitThreshold}
              onChange={(e) => setExitThreshold(Number(e.target.value))}
              step={0.1}
              min={-1}
              max={1}
              className="w-full px-3 py-2 bg-crypto-bg border border-crypto-border rounded-md text-crypto-text"
            />
          </div>

          {/* Stop Loss */}
          <div>
            <label className="text-sm text-crypto-muted mb-2 block">Stop Loss Z</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              step={0.1}
              min={2}
              max={5}
              className="w-full px-3 py-2 bg-crypto-bg border border-crypto-border rounded-md text-crypto-text"
            />
          </div>

          {/* Dynamic Hedge Toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDynamicHedge}
                onChange={(e) => setUseDynamicHedge(e.target.checked)}
                className="rounded border-crypto-border bg-crypto-bg text-crypto-accent"
              />
              <span className="text-sm text-crypto-text">Kalman (Dynamic Hedge)</span>
            </label>
          </div>
        </div>

        {/* Run Button */}
        <div className="mt-6">
          <button
            onClick={handleRun}
            disabled={isLoading || symbol1 === symbol2}
            className={cn(
              "px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              isLoading || symbol1 === symbol2
                ? "bg-crypto-muted/20 text-crypto-muted cursor-not-allowed"
                : "bg-crypto-accent text-white hover:bg-crypto-accent/80"
            )}
          >
            {isLoading ? (
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
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              icon={TrendingUp}
              label="Total Return"
              value={`${(result.metrics.totalReturn * 100).toFixed(2)}%`}
              valueClass={result.metrics.totalReturn >= 0 ? "text-green-500" : "text-red-500"}
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
              value={`${(result.metrics.maxDrawdown * 100).toFixed(2)}%`}
              valueClass="text-red-500"
            />
            <MetricCard
              icon={Percent}
              label="Win Rate"
              value={`${(result.metrics.winRate * 100).toFixed(1)}%`}
              valueClass={result.metrics.winRate >= 0.5 ? "text-green-500" : "text-crypto-text"}
            />
            <MetricCard
              icon={Target}
              label="Profit Factor"
              value={result.metrics.profitFactor.toFixed(2)}
              valueClass={result.metrics.profitFactor >= 1.5 ? "text-green-500" : "text-crypto-text"}
            />
            <MetricCard
              icon={Clock}
              label="Total Trades"
              value={result.metrics.totalTrades.toString()}
            />
          </div>

          {/* Equity Curve */}
          <div className="bg-crypto-card rounded-lg border border-crypto-border p-6">
            <h3 className="text-lg font-semibold text-crypto-text mb-4">Equity Curve</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={equityChartData}>
                  <XAxis
                    dataKey="bar"
                    stroke="#6b7280"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(v) => v.toFixed(2)}
                    domain={["dataMin", "dataMax"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a2e",
                      border: "1px solid #2d2d44",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#9ca3af" }}
                    formatter={(value) => [`${((value as number) - 1) * 100}%`, "Return"]}
                  />
                  <ReferenceLine y={1} stroke="#6b7280" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
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
                  <TableHead className="text-crypto-muted text-right">Bars</TableHead>
                  <TableHead className="text-crypto-muted">Exit Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedTrades.slice(0, 50).map((trade) => (
                  <TableRow key={trade.id} className="border-crypto-border">
                    <TableCell className="text-crypto-muted">{trade.id}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "px-2 py-1 text-xs rounded",
                        trade.side === "Long"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-red-500/20 text-red-500"
                      )}>
                        {trade.side}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-crypto-text">{trade.entryZ}</TableCell>
                    <TableCell className="text-right font-mono text-crypto-text">{trade.exitZ}</TableCell>
                    <TableCell className={cn("text-right font-mono font-semibold", trade.pnlClass)}>
                      {trade.pnl}
                    </TableCell>
                    <TableCell className="text-right text-crypto-text">{trade.holdingPeriod}</TableCell>
                    <TableCell className="text-crypto-muted capitalize">{trade.exitReason}</TableCell>
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
    </div>
  );
}
