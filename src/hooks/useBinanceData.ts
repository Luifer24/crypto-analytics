import { useQuery } from "@tanstack/react-query";

const BINANCE_API = "https://api.binance.com/api/v3";

// Map CoinGecko IDs to Binance symbols
const SYMBOL_MAP: Record<string, string> = {
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

// Binance intervals
export type BinanceInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w" | "1M";

export interface BinanceKline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Get Binance symbol from CoinGecko ID
export const getBinanceSymbol = (coinId: string): string | null => {
  return SYMBOL_MAP[coinId] || null;
};

// Check if a coin is supported by Binance
export const isBinanceSupported = (coinId: string): boolean => {
  return coinId in SYMBOL_MAP;
};

// Fetch klines (candlestick data) from Binance
const fetchKlines = async (
  symbol: string,
  interval: BinanceInterval,
  limit: number = 500
): Promise<BinanceKline[]> => {
  const response = await fetch(
    `${BINANCE_API}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = await response.json();

  return data.map((kline: (string | number)[]) => ({
    openTime: kline[0] as number,
    open: parseFloat(kline[1] as string),
    high: parseFloat(kline[2] as string),
    low: parseFloat(kline[3] as string),
    close: parseFloat(kline[4] as string),
    volume: parseFloat(kline[5] as string),
    closeTime: kline[6] as number,
  }));
};

// Hook for OHLC data
export const useBinanceOHLC = (
  coinId: string,
  interval: BinanceInterval = "1d",
  limit: number = 100
) => {
  const symbol = getBinanceSymbol(coinId);

  return useQuery<OHLCPoint[]>({
    queryKey: ["binanceOHLC", coinId, interval, limit],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);

      const klines = await fetchKlines(symbol, interval, limit);

      return klines.map((k) => ({
        timestamp: k.openTime,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
      }));
    },
    enabled: !!symbol,
    staleTime: interval === "1d" ? 60 * 60 * 1000 : 5 * 60 * 1000, // 1h for daily, 5min for others
    gcTime: 60 * 60 * 1000, // 1 hour cache
    retry: 2,
  });
};

// Hook for price history (close prices only)
export const useBinancePriceHistory = (
  coinId: string,
  interval: BinanceInterval = "1d",
  limit: number = 100
) => {
  const symbol = getBinanceSymbol(coinId);

  return useQuery<PricePoint[]>({
    queryKey: ["binancePrices", coinId, interval, limit],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);

      const klines = await fetchKlines(symbol, interval, limit);

      return klines.map((k) => ({
        timestamp: k.openTime,
        price: k.close,
      }));
    },
    enabled: !!symbol,
    staleTime: interval === "1d" ? 60 * 60 * 1000 : 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
  });
};

// Hook for current price from Binance
export const useBinancePrice = (coinId: string) => {
  const symbol = getBinanceSymbol(coinId);

  return useQuery<number>({
    queryKey: ["binancePrice", coinId],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);

      const response = await fetch(`${BINANCE_API}/ticker/price?symbol=${symbol}`);
      if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

      const data = await response.json();
      return parseFloat(data.price);
    },
    enabled: !!symbol,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
};

// Hook for 24h ticker stats
export const useBinance24hStats = (coinId: string) => {
  const symbol = getBinanceSymbol(coinId);

  return useQuery({
    queryKey: ["binance24h", coinId],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);

      const response = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
      if (!response.ok) throw new Error(`Binance API error: ${response.status}`);

      const data = await response.json();
      return {
        price: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volume24h: parseFloat(data.volume),
        quoteVolume24h: parseFloat(data.quoteVolume),
      };
    },
    enabled: !!symbol,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
};

// Helper to convert days to interval and limit
export const daysToIntervalAndLimit = (days: number): { interval: BinanceInterval; limit: number } => {
  if (days <= 1) return { interval: "1h", limit: 24 };
  if (days <= 7) return { interval: "4h", limit: 42 };
  if (days <= 30) return { interval: "1d", limit: 30 };
  if (days <= 90) return { interval: "1d", limit: 90 };
  if (days <= 365) return { interval: "1d", limit: 365 };
  return { interval: "1w", limit: Math.min(days / 7, 500) };
};
