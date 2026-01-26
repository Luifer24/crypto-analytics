"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Calendar, Clock, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  intervals: string[];
  priceDataPoints: number;
  fundingDataPoints: number;
  firstDate: string | null;
  lastDate: string | null;
}

interface SymbolsResponse {
  exportedAt: string;
  count: number;
  symbols: SymbolInfo[];
}

async function fetchDatabaseInfo(): Promise<SymbolsResponse> {
  const res = await fetch("/data/futures/symbols.json");
  if (!res.ok) {
    throw new Error("Database not found. Run: npm run db:futures:export");
  }
  return res.json();
}

export default function DatabasePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["database-info"],
    queryFn: fetchDatabaseInfo,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-crypto-text flex items-center gap-3">
          <Database className="w-8 h-8 text-crypto-accent" />
          Local Database
        </h1>
        <p className="text-crypto-muted mt-1">
          View available symbols and data ranges in your local database
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="bg-crypto-card rounded-lg border border-crypto-border p-8 text-center">
          <p className="text-crypto-muted">Loading database info...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-500 mb-2">Database not found</p>
          <p className="text-crypto-muted text-sm">
            Run <code className="bg-crypto-bg px-2 py-1 rounded">npm run db:futures:export</code> to export data
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                Total Symbols
              </div>
              <p className="text-3xl font-bold text-crypto-text">{data.count}</p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <Clock className="w-4 h-4" />
                Intervals Available
              </div>
              <p className="text-3xl font-bold text-crypto-text">
                {Array.from(new Set(data.symbols.flatMap(s => s.intervals))).length}
              </p>
              <p className="text-xs text-crypto-muted mt-1">
                {Array.from(new Set(data.symbols.flatMap(s => s.intervals))).join(", ")}
              </p>
            </div>

            <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
              <div className="flex items-center gap-2 text-crypto-muted text-sm mb-2">
                <Calendar className="w-4 h-4" />
                Last Updated
              </div>
              <p className="text-lg font-bold text-crypto-text">
                {new Date(data.exportedAt).toLocaleString("es-ES", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Symbols Table */}
          <div className="bg-crypto-card rounded-lg border border-crypto-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-crypto-border hover:bg-transparent">
                  <TableHead className="text-crypto-muted">Symbol</TableHead>
                  <TableHead className="text-crypto-muted">Intervals</TableHead>
                  <TableHead className="text-crypto-muted text-right">Price Data Points</TableHead>
                  <TableHead className="text-crypto-muted text-right">Funding Rates</TableHead>
                  <TableHead className="text-crypto-muted">First Date</TableHead>
                  <TableHead className="text-crypto-muted">Last Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.symbols.map((symbol) => (
                  <TableRow key={symbol.symbol} className="border-crypto-border hover:bg-crypto-bg/50">
                    <TableCell className="font-medium text-crypto-text font-mono">
                      {symbol.baseAsset}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {symbol.intervals.map((interval) => (
                          <span
                            key={interval}
                            className="px-2 py-0.5 text-xs rounded bg-crypto-accent/20 text-crypto-accent"
                          >
                            {interval}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-crypto-muted font-mono text-sm">
                      {symbol.priceDataPoints.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-crypto-muted font-mono text-sm">
                      {symbol.fundingDataPoints.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-crypto-muted text-sm">
                      {symbol.firstDate
                        ? new Date(symbol.firstDate).toLocaleDateString("es-ES")
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-crypto-muted text-sm">
                      {symbol.lastDate
                        ? new Date(symbol.lastDate).toLocaleDateString("es-ES")
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
