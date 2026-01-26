/**
 * Binance Futures Data Hooks
 *
 * Access local Binance Futures historical data
 */

import { useQuery } from "@tanstack/react-query";

export interface FuturesSymbol {
  symbol: string;
  baseAsset: string;
  intervals: string[];
  priceDataPoints: number;
  fundingDataPoints: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface FuturesSymbolsResponse {
  exportedAt: string;
  count: number;
  symbols: FuturesSymbol[];
}

export interface FuturesPriceData {
  t: number; // timestamp in ms
  i: string; // interval
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  qv: number; // quote volume
}

export interface FuturesPriceResponse {
  symbol: string;
  exportedAt: string;
  count: number;
  data: FuturesPriceData[];
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

/**
 * Get list of available Futures symbols
 */
export function useFuturesSymbols() {
  return useQuery({
    queryKey: ["futures-symbols"],
    queryFn: async (): Promise<FuturesSymbolsResponse> => {
      const res = await fetch("/data/futures/symbols.json");
      if (!res.ok) {
        throw new Error("Failed to load Futures symbols");
      }
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Get price history for a specific symbol
 *
 * @param symbol - Base asset symbol (e.g., "BTC", "ETH")
 * @param days - Number of days of history to load
 * @param interval - Price interval ("5m", "15m", "1h", "4h", "1d")
 */
export function useFuturesPriceHistory(
  symbol: string | null,
  days: number = 180,
  interval: "5m" | "15m" | "1h" | "4h" | "1d" = "1d"
) {
  return useQuery({
    queryKey: ["futures-price-history", symbol, days, interval],
    queryFn: async (): Promise<PricePoint[]> => {
      if (!symbol) return [];

      // Convert symbol to futures format (e.g., "BTC" -> "BTCUSDT")
      const futuresSymbol = `${symbol.toUpperCase()}USDT`;

      const res = await fetch(`/data/futures/prices/${futuresSymbol}.json`);
      if (!res.ok) {
        throw new Error(`Failed to load price data for ${futuresSymbol}`);
      }

      const data: FuturesPriceResponse = await res.json();

      // Filter by interval and time range
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

      const filtered = data.data
        .filter((d) => d.i === interval && d.t >= cutoffTime)
        .map((d) => ({
          timestamp: d.t,
          price: d.c, // Use close price
        }));

      // Sort by timestamp ascending
      return filtered.sort((a, b) => a.timestamp - b.timestamp);
    },
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Check if a symbol is available in Futures database
 */
export function isFuturesSupported(symbol: string, symbols?: FuturesSymbolsResponse): boolean {
  if (!symbols) return false;
  const upperSymbol = symbol.toUpperCase();
  return symbols.symbols.some((s) => s.baseAsset === upperSymbol);
}
