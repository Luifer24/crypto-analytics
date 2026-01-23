"use client";

import { useState, useMemo } from "react";
import { useCryptoList } from "@/hooks/useCryptoData";
import { usePairScanner, getScanSummary } from "@/hooks/usePairScanner";
import { isCryptoCompareSupported } from "@/hooks/useCryptoCompareData";
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
} from "lucide-react";
import Link from "next/link";
import type { PairScanResult, Signal } from "@/types/arbitrage";

// Number of top coins to scan
const SCAN_OPTIONS = [
  { label: "Top 10", value: 10 },
  { label: "Top 20", value: 20 },
  { label: "Top 30", value: 30 },
];

const LOOKBACK_OPTIONS = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "180 Days", value: 180 },
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
  return (
    <span className={cn(
      "px-2 py-1 text-xs rounded flex items-center gap-1",
      isCointegrated ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
    )}>
      {isCointegrated ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {(pValue * 100).toFixed(1)}%
    </span>
  );
}

export default function ScannerPage() {
  const [topN, setTopN] = useState(20);
  const [lookbackDays, setLookbackDays] = useState(90);
  const [showOnlyCointegrated, setShowOnlyCointegrated] = useState(false);
  const [showOnlySignals, setShowOnlySignals] = useState(false);
  const [sortBy, setSortBy] = useState<"score" | "pValue" | "halfLife" | "zScore">("score");

  // Get top cryptos
  const { data: cryptoList, isLoading: listLoading } = useCryptoList(50);

  // Filter supported cryptos and take top N
  const coinIds = useMemo(() => {
    if (!cryptoList) return [];
    return cryptoList
      .filter(c => isCryptoCompareSupported(c.id))
      .slice(0, topN)
      .map(c => c.id);
  }, [cryptoList, topN]);

  // Run the scanner
  const {
    isLoading: scanLoading,
    isError,
    progress,
    allResults,
    filteredResults,
  } = usePairScanner(coinIds, {
    lookbackDays,
    minCorrelation: 0.3,
    maxPValue: 0.15,
    minHalfLife: 1,
    maxHalfLife: 150,
  });

  // Apply UI filters and sorting
  const displayResults = useMemo(() => {
    let results = allResults || [];

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
        default:
          return b.score - a.score;
      }
    });

    return results;
  }, [allResults, showOnlyCointegrated, showOnlySignals, sortBy]);

  // Summary stats
  const summary = getScanSummary(allResults);

  const isLoading = listLoading || scanLoading;

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
          {/* Top N selector */}
          <Select value={String(topN)} onValueChange={(v) => setTopN(Number(v))}>
            <SelectTrigger className="w-32 bg-crypto-bg border-crypto-border text-crypto-text">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-crypto-card border-crypto-border">
              {SCAN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)} className="text-crypto-text">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-crypto-accent mx-auto mb-4" />
          <p className="text-crypto-text font-medium">Scanning pairs...</p>
          <p className="text-crypto-muted text-sm mt-1">
            Loading {progress.loaded}/{progress.total} coins
          </p>
          <div className="w-48 h-2 bg-crypto-bg rounded-full mx-auto mt-4 overflow-hidden">
            <div
              className="h-full bg-crypto-accent transition-all duration-300"
              style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-500">Error loading data. Please try again.</p>
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && allResults && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
              </SelectContent>
            </Select>

            <span className="text-sm text-crypto-muted ml-auto">
              Showing {displayResults.length} pairs
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
                  <TableHead className="text-crypto-muted text-right">Hedge Ratio</TableHead>
                  <TableHead className="text-crypto-muted text-center">Signal</TableHead>
                  <TableHead className="text-crypto-muted"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayResults.map((result, idx) => (
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
                        result.halfLife >= 5 && result.halfLife <= 30
                          ? "text-green-500"
                          : "text-crypto-text"
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
                    <TableCell>
                      <Link
                        href={`/compare?asset1=${result.pair[0]}&asset2=${result.pair[1]}`}
                        className="text-crypto-accent hover:underline text-sm"
                      >
                        Analyze
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
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
