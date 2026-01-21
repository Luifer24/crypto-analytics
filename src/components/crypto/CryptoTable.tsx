"use client";

import { useState, useMemo } from "react";
import { useCryptoCompareList } from "@/hooks/useCryptoCompareList";
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import type { CryptoAsset } from "@/types/crypto";

type SortColumn = "rank" | "name" | "price" | "change24h" | "marketCap" | "volume" | "high24h" | "low24h";
type SortDirection = "asc" | "desc";

const formatPrice = (price: number): string => {
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
};

const formatMarketCap = (num: number): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toFixed(0)}`;
};

interface CryptoTableProps {
  limit?: number;
  onSelectCoin?: (coinId: string) => void;
  data?: CryptoAsset[]; // Optional: pass pre-filtered data
  isLoading?: boolean;
}

export const CryptoTable = ({ limit = 20, onSelectCoin, data, isLoading: externalLoading }: CryptoTableProps) => {
  const { data: fetchedCryptos, isLoading: fetchLoading } = useCryptoCompareList(limit);
  const [sortColumn, setSortColumn] = useState<SortColumn>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Use passed data if provided, otherwise use fetched data
  const rawCryptos = data ?? fetchedCryptos;
  const isLoading = data ? externalLoading : fetchLoading;

  // Sort cryptos based on selected column
  const cryptos = useMemo(() => {
    if (!rawCryptos) return rawCryptos;

    return [...rawCryptos].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case "rank":
          comparison = (a.market_cap_rank || 0) - (b.market_cap_rank || 0);
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "price":
          comparison = (a.current_price || 0) - (b.current_price || 0);
          break;
        case "change24h":
          comparison = (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0);
          break;
        case "marketCap":
          comparison = (a.market_cap || 0) - (b.market_cap || 0);
          break;
        case "volume":
          comparison = (a.total_volume || 0) - (b.total_volume || 0);
          break;
        case "high24h":
          comparison = (a.high_24h || 0) - (b.high_24h || 0);
          break;
        case "low24h":
          comparison = (a.low_24h || 0) - (b.low_24h || 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rawCryptos, sortColumn, sortDirection]);

  // Handle column header click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with default direction
      setSortColumn(column);
      // Default to desc for numeric values (show highest first), asc for name/rank
      setSortDirection(column === "name" || column === "rank" ? "asc" : "desc");
    }
  };

  // Sort indicator component
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    }
    return sortDirection === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="bg-crypto-card rounded-lg border border-crypto-border p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-crypto-border rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-crypto-card rounded-lg border border-crypto-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-crypto-border hover:bg-transparent">
            <TableHead
              className="text-crypto-muted w-12 cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("rank")}
            >
              <span className="inline-flex items-center">
                #
                <SortIndicator column="rank" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("name")}
            >
              <span className="inline-flex items-center">
                Name
                <SortIndicator column="name" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("price")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Price
                <SortIndicator column="price" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("change24h")}
            >
              <span className="inline-flex items-center justify-end w-full">
                24h %
                <SortIndicator column="change24h" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right hidden md:table-cell cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("marketCap")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Market Cap
                <SortIndicator column="marketCap" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right hidden lg:table-cell cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("volume")}
            >
              <span className="inline-flex items-center justify-end w-full">
                Volume (24h)
                <SortIndicator column="volume" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right hidden xl:table-cell cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("high24h")}
            >
              <span className="inline-flex items-center justify-end w-full">
                24h High
                <SortIndicator column="high24h" />
              </span>
            </TableHead>
            <TableHead
              className="text-crypto-muted text-right hidden xl:table-cell cursor-pointer hover:text-crypto-text transition-colors select-none"
              onClick={() => handleSort("low24h")}
            >
              <span className="inline-flex items-center justify-end w-full">
                24h Low
                <SortIndicator column="low24h" />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cryptos?.map((crypto) => {
            const change24h = crypto.price_change_percentage_24h || 0;

            return (
              <TableRow
                key={crypto.id}
                className="border-crypto-border hover:bg-crypto-border/30 cursor-pointer"
                onClick={() => onSelectCoin?.(crypto.id)}
              >
                <TableCell className="text-crypto-muted font-medium">
                  {crypto.market_cap_rank}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Image
                      src={crypto.image}
                      alt={crypto.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <div>
                      <span className="font-medium text-crypto-text">{crypto.name}</span>
                      <span className="text-crypto-muted text-xs ml-2 uppercase">
                        {crypto.symbol}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-crypto-text">
                  {formatPrice(crypto.current_price)}
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "inline-flex items-center font-medium",
                      change24h >= 0 ? "text-crypto-positive" : "text-crypto-negative"
                    )}
                  >
                    {change24h >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(change24h).toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right hidden md:table-cell text-crypto-text font-mono">
                  {formatMarketCap(crypto.market_cap)}
                </TableCell>
                <TableCell className="text-right hidden lg:table-cell text-crypto-muted font-mono">
                  {formatMarketCap(crypto.total_volume)}
                </TableCell>
                <TableCell className="text-right hidden xl:table-cell text-crypto-positive font-mono">
                  {crypto.high_24h ? formatPrice(crypto.high_24h) : "-"}
                </TableCell>
                <TableCell className="text-right hidden xl:table-cell text-crypto-negative font-mono">
                  {crypto.low_24h ? formatPrice(crypto.low_24h) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
