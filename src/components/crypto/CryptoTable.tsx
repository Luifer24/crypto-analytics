"use client";

import { useCryptoList } from "@/hooks/useCryptoData";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";

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
}

export const CryptoTable = ({ limit = 20, onSelectCoin }: CryptoTableProps) => {
  const { data: cryptos, isLoading } = useCryptoList(limit);

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
            <TableHead className="text-crypto-muted w-12">#</TableHead>
            <TableHead className="text-crypto-muted">Name</TableHead>
            <TableHead className="text-crypto-muted text-right">Price</TableHead>
            <TableHead className="text-crypto-muted text-right">24h %</TableHead>
            <TableHead className="text-crypto-muted text-right hidden md:table-cell">7d %</TableHead>
            <TableHead className="text-crypto-muted text-right hidden lg:table-cell">Market Cap</TableHead>
            <TableHead className="text-crypto-muted text-right hidden xl:table-cell">Volume (24h)</TableHead>
            <TableHead className="text-crypto-muted hidden xl:table-cell w-32">Last 7 Days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cryptos?.map((crypto) => {
            const change24h = crypto.price_change_percentage_24h || 0;
            const change7d = crypto.price_change_percentage_7d_in_currency || 0;

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
                <TableCell className="text-right hidden md:table-cell">
                  <span
                    className={cn(
                      "font-medium",
                      change7d >= 0 ? "text-crypto-positive" : "text-crypto-negative"
                    )}
                  >
                    {change7d >= 0 ? "+" : ""}
                    {change7d.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell className="text-right hidden lg:table-cell text-crypto-text font-mono">
                  {formatMarketCap(crypto.market_cap)}
                </TableCell>
                <TableCell className="text-right hidden xl:table-cell text-crypto-muted font-mono">
                  {formatMarketCap(crypto.total_volume)}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {crypto.sparkline_in_7d?.price && (
                    <MiniSparkline
                      data={crypto.sparkline_in_7d.price}
                      positive={change7d >= 0}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
