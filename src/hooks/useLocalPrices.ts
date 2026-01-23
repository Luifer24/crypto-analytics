/**
 * Hook for Local Price Data
 *
 * Fetches price data from static JSON files exported from DuckDB.
 * Files are located in /public/data/prices/{SYMBOL}.json
 */

import { useQuery } from "@tanstack/react-query";

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Compressed format from JSON files
interface CompressedOHLCV {
  t: number; // timestamp
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

interface PriceFileResponse {
  symbol: string;
  name: string;
  data: CompressedOHLCV[];
  exportedAt: string;
}

/**
 * Map from CoinGecko IDs to Binance symbols
 */
const COINGECKO_TO_BINANCE: Record<string, string> = {
  bitcoin: "BTCUSDT",
  ethereum: "ETHUSDT",
  binancecoin: "BNBUSDT",
  solana: "SOLUSDT",
  ripple: "XRPUSDT",
  cardano: "ADAUSDT",
  dogecoin: "DOGEUSDT",
  polkadot: "DOTUSDT",
  avalanche: "AVAXUSDT",
  chainlink: "LINKUSDT",
  polygon: "MATICUSDT",
  litecoin: "LTCUSDT",
  uniswap: "UNIUSDT",
  stellar: "XLMUSDT",
  monero: "XMRUSDT",
  "ethereum-classic": "ETCUSDT",
  filecoin: "FILUSDT",
  cosmos: "ATOMUSDT",
  tron: "TRXUSDT",
  near: "NEARUSDT",
  algorand: "ALGOUSDT",
  fantom: "FTMUSDT",
  aptos: "APTUSDT",
  arbitrum: "ARBUSDT",
  optimism: "OPUSDT",
  sui: "SUIUSDT",
  pepe: "PEPEUSDT",
  shiba: "SHIBUSDT",
};

/**
 * Convert CoinGecko ID to Binance symbol
 */
export function toBinanceSymbol(coinId: string): string | null {
  return COINGECKO_TO_BINANCE[coinId] || null;
}

/**
 * Fetch price data from static JSON file
 */
async function fetchLocalPrices(symbol: string, days: number): Promise<PricePoint[]> {
  const response = await fetch(`/data/prices/${symbol}.json`);

  if (!response.ok) {
    throw new Error(`Data not found for ${symbol}`);
  }

  const data: PriceFileResponse = await response.json();

  // Filter by days if needed
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  return data.data
    .filter((row) => row.t >= cutoffTime)
    .map((row) => ({
      timestamp: row.t,
      price: row.c, // Use close price
    }));
}

/**
 * Fetch OHLCV data from static JSON file
 */
async function fetchLocalOHLCV(symbol: string, days: number): Promise<OHLCVPoint[]> {
  const response = await fetch(`/data/prices/${symbol}.json`);

  if (!response.ok) {
    throw new Error(`Data not found for ${symbol}`);
  }

  const data: PriceFileResponse = await response.json();

  // Filter by days if needed
  const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

  return data.data
    .filter((row) => row.t >= cutoffTime)
    .map((row) => ({
      timestamp: row.t,
      open: row.o,
      high: row.h,
      low: row.l,
      close: row.c,
      volume: row.v,
    }));
}

/**
 * Hook to get close prices from local database
 *
 * @param coinId - CoinGecko ID (e.g., "bitcoin") or Binance symbol (e.g., "BTCUSDT")
 * @param days - Number of days of history
 */
export function useLocalPrices(coinId: string, days: number = 90) {
  // Convert to Binance symbol if needed
  const symbol = coinId.includes("USDT") ? coinId : toBinanceSymbol(coinId);

  return useQuery<PricePoint[]>({
    queryKey: ["localPrices", symbol, days],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unknown coin: ${coinId}`);
      return fetchLocalPrices(symbol, days);
    },
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000, // 1 hour - local data doesn't change often
    gcTime: 24 * 60 * 60 * 1000, // 24 hours cache
    retry: 1,
  });
}

/**
 * Hook to get OHLCV data from local database
 */
export function useLocalOHLCV(coinId: string, days: number = 90) {
  const symbol = coinId.includes("USDT") ? coinId : toBinanceSymbol(coinId);

  return useQuery<OHLCVPoint[]>({
    queryKey: ["localOHLCV", symbol, days],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unknown coin: ${coinId}`);
      return fetchLocalOHLCV(symbol, days);
    },
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/**
 * Hook to get close prices as array only (for calculations)
 */
export function useLocalClosePrices(coinId: string, days: number = 90) {
  const { data, isLoading, isError } = useLocalPrices(coinId, days);

  return {
    prices: data?.map((p) => p.price) ?? null,
    timestamps: data?.map((p) => p.timestamp) ?? null,
    isLoading,
    isError,
    hasData: !!data && data.length >= 30,
  };
}

/**
 * Check if local data is available for a symbol
 */
export async function checkLocalDataAvailable(coinId: string, minDays: number = 30): Promise<boolean> {
  const symbol = coinId.includes("USDT") ? coinId : toBinanceSymbol(coinId);
  if (!symbol) return false;

  try {
    const response = await fetch(`/data/prices/${symbol}.json`);
    if (!response.ok) return false;

    const data: PriceFileResponse = await response.json();
    const cutoffTime = Date.now() - minDays * 24 * 60 * 60 * 1000;
    const recentData = data.data.filter(row => row.t >= cutoffTime);
    return recentData.length >= minDays;
  } catch {
    return false;
  }
}
