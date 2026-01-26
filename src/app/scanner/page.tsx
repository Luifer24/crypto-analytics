"use client";

import { useState, useMemo } from "react";
import { useLocalPairScanner, getLocalScanSummary } from "@/hooks/useLocalPairScanner";
import { useFuturesPairScanner, getFuturesScanSummary, type FuturesPairScanResult } from "@/hooks/useFuturesPairScanner";
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
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Filter,
  BarChart3,
  Target,
  Wallet,
  LineChart,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type { PairScanResult, Signal } from "@/types/arbitrage";

type DataSource = "spot" | "futures";

const LOOKBACK_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
];

const INTERVAL_OPTIONS = [
  { label: "5 min", value: "5m" },
  { label: "15 min", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "4 hours", value: "4h" },
  { label: "1 day", value: "1d" },
];

function SignalBadge({ signal, strength }: { signal: Signal; strength: string }) {
  if (signal === "neutral") {
    return (
      <span className="px-2 py-1 text-xs rounded bg-crypto-bg text-crypto-muted">
        Neutral
      </span>
    );
  }

  const isLong = signal === "long_a_short_b";
  return (
    <span className={cn(
      "px-2 py-1 text-xs rounded flex items-center gap-1",
      isLong ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
    )}>
      {isLong ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {strength}
    </span>
  );
}

function CointegrationBadge({ isCointegrated, pValue }: { isCointegrated: boolean; pValue: number }) {
  // Use p-value directly: < 5% = cointegrated (green), >= 5% = not cointegrated (red)
  const isActuallyCointegrated = pValue < 0.05;

  return (
    <span className={cn(
      "px-2 py-1 text-xs rounded flex items-center gap-1",
      isActuallyCointegrated ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
    )}>
      {isActuallyCointegrated ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {(pValue * 100).toFixed(1)}%
    </span>
  );
}

function FundingBadge({ rate }: { rate: number }) {
  const isPositive = rate > 0;
  return (
    <span className={cn(
      "font-mono text-xs",
      isPositive ? "text-green-500" : "text-red-500"
    )}>
      {isPositive ? "+" : ""}{rate.toFixed(1)}%
    </span>
  );
}

export default function ScannerPage() {
  const [dataSource, setDataSource] = useState<DataSource>("futures");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [interval, setInterval] = useState<"5m" | "15m" | "1h" | "4h" | "1d">("15m");
  const [showOnlyCointegrated, setShowOnlyCointegrated] = useState(false);
  const [showOnlySignals, setShowOnlySignals] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "pValue" | "halfLife" | "zScore" | "funding">("score");
  const [searchTerm, setSearchTerm] = useState("");

  // Run the appropriate scanner (with built-in caching)
  const spotScanner = useLocalPairScanner({
    lookbackDays,
    minCorrelation: 0.3,
    maxPValue: 0.15,
    minHalfLife: 1,
    maxHalfLife: 150,
  });

  const futuresScanner = useFuturesPairScanner({
    lookbackDays,
    interval,
    minCorrelation: 0.3,
    maxPValue: 0.15,
    minHalfLife: 1,
    maxHalfLife: 150,
    includeFunding: true,
  });

  // Select active scanner
  const scanner = dataSource === "futures" ? futuresScanner : spotScanner;
  const allResults = scanner.allResults;

  // Apply UI filters and sorting
  const displayResults = useMemo(() => {
    let results = (allResults || []) as (PairScanResult | FuturesPairScanResult)[];

    // Filter by search term (search in both symbols)
    if (searchTerm) {
      const search = searchTerm.toUpperCase();
      results = results.filter(r =>
        r.symbols[0].includes(search) || r.symbols[1].includes(search)
      );
    }

    if (showOnlyCointegrated) {
      results = results.filter(r => r.isCointegrated);
    }

    if (showOnlySignals) {
      results = results.filter(r => r.signal !== "neutral");
    }

    // Sort
    results = [...results].sort((a, b) => {
      switch (sortBy) {
        case "score":
          return b.score - a.score;
        case "pValue":
          return a.pValue - b.pValue;
        case "halfLife":
          return a.halfLife - b.halfLife;
        case "zScore":
          return Math.abs(b.currentZScore) - Math.abs(a.currentZScore);
        case "funding":
          if (dataSource === "futures") {
            const aFunding = (a as FuturesPairScanResult).fundingArbScore || 0;
            const bFunding = (b as FuturesPairScanResult).fundingArbScore || 0;
            return bFunding - aFunding;
          }
          return b.score - a.score;
        default:
          return b.score - a.score;
      }
    });

    return results;
  }, [allResults, showOnlyCointegrated, showOnlySignals, sortBy, dataSource, searchTerm]);

  // Summary stats
  const summary = dataSource === "futures"
    ? getFuturesScanSummary(allResults as FuturesPairScanResult[] | null)
    : getLocalScanSummary(allResults);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-crypto-text flex items-center gap-2">
            <Search className="w-6 h-6 text-crypto-accent" />
            Pair Scanner
          </h1>
          <p className="text-crypto-muted mt-1">
            Find cointegrated pairs for statistical arbitrage
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Data source toggle */}
          <div className="flex rounded-lg border border-crypto-border overflow-hidden">
            <button
              onClick={() => setDataSource("spot")}
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                dataSource === "spot"
                  ? "bg-crypto-accent text-white"
                  : "bg-crypto-bg text-crypto-muted hover:text-crypto-text"
              )}
            >
              <LineChart className="w-4 h-4" />
              Spot
            </button>
            <button
              onClick={() => setDataSource("futures")}
              className={cn(
                "px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors",
                dataSource === "futures"
                  ? "bg-crypto-accent text-white"
                  : "bg-crypto-bg text-crypto-muted hover:text-crypto-text"
              )}
            >
              <Wallet className="w-4 h-4" />
              Futures
            </button>
          </div>

          {/* Interval selector (futures only) */}
          {dataSource === "futures" && (
            <Select value={interval} onValueChange={(v) => setInterval(v as typeof interval)}>
              <SelectTrigger className="w-24 bg-crypto-bg border-crypto-border text-crypto-text">
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
          )}

          {/* Lookback selector */}
          <Select value={String(lookbackDays)} onValueChange={(v) => setLookbackDays(Number(v))}>
            <SelectTrigger className="w-32 bg-crypto-bg border-crypto-border text-crypto-text">
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

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-crypto-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search symbol..."
              className="pl-9 pr-3 py-1.5 w-40 bg-crypto-bg border border-crypto-border rounded text-crypto-text text-sm placeholder:text-crypto-muted focus:outline-none focus:ring-1 focus:ring-crypto-accent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-crypto-muted hover:text-crypto-text"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              console.log("[Scanner] Manual refresh triggered");
              scanner.refetch();
            }}
            className="px-3 py-1.5 text-sm flex items-center gap-1.5 bg-crypto-bg border border-crypto-border rounded text-crypto-text hover:bg-crypto-card transition-colors disabled:opacity-50"
            title="Re-scan all pairs"
            disabled={scanner.isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${scanner.isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {scanner.isLoading && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-crypto-accent" />
            <div className="flex-1">
              <p className="text-crypto-text font-medium">
                Scanning {dataSource} pairs...
              </p>
              <p className="text-crypto-muted text-sm">
                Loading data and analyzing cointegration relationships
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {scanner.isError && !scanner.isLoading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500 mb-2">
            {dataSource === "futures" ? "Futures data not found." : "Spot data not found."}
          </p>
          <p className="text-crypto-muted text-sm">
            Run{" "}
            <code className="bg-crypto-bg px-2 py-1 rounded">
              {dataSource === "futures" ? "npm run db:futures:export" : "npm run db:update"}
            </code>{" "}
            to export data.
          </p>
        </div>
      )}

      {/* Results */}
      {!scanner.isError && allResults && allResults.length > 0 && (
        <>
          {/* Summary Cards */}
          <div className={cn(
            "grid gap-4",
            dataSource === "futures" ? "grid-cols-2 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-5"
          )}>
            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <BarChart3 className="w-4 h-4" />
                Total Pairs
              </div>
              <p className="text-2xl font-bold text-crypto-text">
                {summary.totalPairs}
              </p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Cointegrated
              </div>
              <p className="text-2xl font-bold text-green-500">
                {summary.cointegratedPairs}
              </p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <Activity className="w-4 h-4 text-crypto-accent" />
                Active Signals
              </div>
              <p className="text-2xl font-bold text-crypto-accent">
                {summary.activeSignals}
              </p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <Target className="w-4 h-4 text-yellow-500" />
                Strong Signals
              </div>
              <p className="text-2xl font-bold text-yellow-500">
                {summary.strongSignals}
              </p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <Clock className="w-4 h-4" />
                Avg Score
              </div>
              <p className="text-2xl font-bold text-crypto-text">
                {summary.avgScore.toFixed(1)}
              </p>
            </div>

            {dataSource === "futures" && "highFundingArb" in summary && (
              <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
                <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                  <Wallet className="w-4 h-4 text-purple-500" />
                  High Funding
                </div>
                <p className="text-2xl font-bold text-purple-500">
                  {(summary as { highFundingArb: number }).highFundingArb}
                </p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-crypto-muted">
              <Filter className="w-4 h-4" />
              <span className="text-sm">Filters:</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyCointegrated}
                onChange={(e) => setShowOnlyCointegrated(e.target.checked)}
                className="rounded border-crypto-border bg-crypto-bg text-crypto-accent"
              />
              <span className="text-sm text-crypto-text">Cointegrated only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlySignals}
                onChange={(e) => setShowOnlySignals(e.target.checked)}
                className="rounded border-crypto-border bg-crypto-bg text-crypto-accent"
              />
              <span className="text-sm text-crypto-text">Active signals only</span>
            </label>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-40 bg-crypto-bg border-crypto-border text-crypto-text text-sm">
                <SelectValue placeholder="Sort by..." />
              </SelectTrigger>
              <SelectContent className="bg-crypto-card border-crypto-border">
                <SelectItem value="score" className="text-crypto-text">Score (High)</SelectItem>
                <SelectItem value="pValue" className="text-crypto-text">P-Value (Low)</SelectItem>
                <SelectItem value="halfLife" className="text-crypto-text">Half-Life (Fast)</SelectItem>
                <SelectItem value="zScore" className="text-crypto-text">Z-Score (Extreme)</SelectItem>
                {dataSource === "futures" && (
                  <SelectItem value="funding" className="text-crypto-text">Funding Spread</SelectItem>
                )}
              </SelectContent>
            </Select>

            <span className="text-sm text-crypto-muted ml-auto">
              Showing {displayResults.length} {searchTerm && `of ${allResults.length}`} pairs
              {searchTerm && <span className="text-crypto-accent ml-1">({searchTerm})</span>}
            </span>
          </div>

          {/* Results Table */}
          <div className="bg-crypto-card rounded-lg border border-crypto-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-crypto-border hover:bg-transparent">
                  <TableHead className="text-crypto-muted">Pair</TableHead>
                  <TableHead className="text-crypto-muted text-right">Score</TableHead>
                  <TableHead className="text-crypto-muted text-center">Cointegrated</TableHead>
                  <TableHead className="text-crypto-muted text-right">Correlation</TableHead>
                  <TableHead className="text-crypto-muted text-right">Half-Life</TableHead>
                  <TableHead className="text-crypto-muted text-right">Z-Score</TableHead>
                  <TableHead className="text-crypto-muted text-right">Hedge</TableHead>
                  <TableHead className="text-crypto-muted text-center">Signal</TableHead>
                  {dataSource === "futures" && (
                    <>
                      <TableHead className="text-crypto-muted text-right">Funding A</TableHead>
                      <TableHead className="text-crypto-muted text-right">Funding B</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayResults.map((result) => {
                  const isFutures = dataSource === "futures";
                  const futuresResult = isFutures ? result as FuturesPairScanResult : null;

                  return (
                    <TableRow
                      key={`${result.pair[0]}-${result.pair[1]}`}
                      className={cn(
                        "border-crypto-border",
                        result.isCointegrated && result.signal !== "neutral"
                          ? "bg-crypto-accent/5"
                          : ""
                      )}
                    >
                      <TableCell className="font-medium text-crypto-text">
                        <span className="font-mono">
                          {result.symbols[0]}/{result.symbols[1]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-mono font-semibold",
                          result.score >= 70 ? "text-green-500" :
                          result.score >= 50 ? "text-yellow-500" : "text-crypto-text"
                        )}>
                          {result.score.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <CointegrationBadge
                          isCointegrated={result.isCointegrated}
                          pValue={result.pValue}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-crypto-text">
                        {result.correlation.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-mono",
                          result.halfLife <= 5 ? "text-green-500" :
                          result.halfLife <= 10 ? "text-yellow-500" : "text-crypto-text"
                        )}>
                          {isFinite(result.halfLife) ? `${result.halfLife.toFixed(1)}d` : "∞"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-mono",
                          Math.abs(result.currentZScore) >= 2 ? "text-yellow-500" :
                          Math.abs(result.currentZScore) >= 1.5 ? "text-crypto-accent" : "text-crypto-text"
                        )}>
                          {result.currentZScore.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-crypto-text">
                        {result.hedgeRatio.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-center">
                        <SignalBadge signal={result.signal} strength={result.signalStrength} />
                      </TableCell>
                      {isFutures && futuresResult && (
                        <>
                          <TableCell className="text-right">
                            <FundingBadge rate={futuresResult.avgFundingRate1} />
                          </TableCell>
                          <TableCell className="text-right">
                            <FundingBadge rate={futuresResult.avgFundingRate2} />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {displayResults.length === 0 && (
              <div className="p-8 text-center text-crypto-muted">
                No pairs match the current filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
