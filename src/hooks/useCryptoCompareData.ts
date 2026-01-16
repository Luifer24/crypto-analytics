import { useQuery } from "@tanstack/react-query";

const CRYPTOCOMPARE_API = "https://min-api.cryptocompare.com/data/v2";

// Map CoinGecko IDs to CryptoCompare symbols
const SYMBOL_MAP: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  binancecoin: "BNB",
  solana: "SOL",
  ripple: "XRP",
  cardano: "ADA",
  dogecoin: "DOGE",
  polkadot: "DOT",
  avalanche: "AVAX",
  chainlink: "LINK",
  polygon: "MATIC",
  litecoin: "LTC",
  uniswap: "UNI",
  stellar: "XLM",
  monero: "XMR",
  "ethereum-classic": "ETC",
  filecoin: "FIL",
  cosmos: "ATOM",
  tron: "TRX",
  near: "NEAR",
  algorand: "ALGO",
  fantom: "FTM",
  aptos: "APT",
  arbitrum: "ARB",
  optimism: "OP",
  sui: "SUI",
  pepe: "PEPE",
  shiba: "SHIB",
  tether: "USDT",
  "usd-coin": "USDC",
  "wrapped-bitcoin": "WBTC",
  "lido-staked-ether": "STETH",
};

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

// Get CryptoCompare symbol from CoinGecko ID
export const getCryptoCompareSymbol = (coinId: string): string | null => {
  return SYMBOL_MAP[coinId] || null;
};

// Check if a coin is supported
export const isCryptoCompareSupported = (coinId: string): boolean => {
  return coinId in SYMBOL_MAP;
};

// Fetch historical OHLC data
const fetchHistoricalData = async (
  symbol: string,
  days: number
): Promise<OHLCPoint[]> => {
  // Use histoday for daily data, histohour for shorter periods
  const endpoint = days <= 1 ? "histohour" : "histoday";
  const limit = days <= 1 ? 24 : Math.min(days, 365);

  const response = await fetch(
    `${CRYPTOCOMPARE_API}/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}`
  );

  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`);
  }

  const json = await response.json();

  if (json.Response !== "Success") {
    throw new Error(json.Message || "Failed to fetch data");
  }

  return json.Data.Data.map((item: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volumefrom: number;
  }) => ({
    timestamp: item.time * 1000, // Convert to milliseconds
    open: item.open,
    high: item.high,
    low: item.low,
    close: item.close,
    volume: item.volumefrom,
  }));
};

// Hook for OHLC data
export const useCryptoCompareOHLC = (coinId: string, days: number = 90) => {
  const symbol = getCryptoCompareSymbol(coinId);

  return useQuery<OHLCPoint[]>({
    queryKey: ["cryptoCompareOHLC", coinId, days],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);
      return fetchHistoricalData(symbol, days);
    },
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000, // 1 hour - historical data doesn't change
    gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    retry: 2,
  });
};

// Hook for price history (close prices only)
export const useCryptoComparePriceHistory = (coinId: string, days: number = 90) => {
  const symbol = getCryptoCompareSymbol(coinId);

  return useQuery<PricePoint[]>({
    queryKey: ["cryptoComparePrices", coinId, days],
    queryFn: async () => {
      if (!symbol) throw new Error(`Unsupported coin: ${coinId}`);
      const ohlc = await fetchHistoricalData(symbol, days);
      return ohlc.map((item) => ({
        timestamp: item.timestamp,
        price: item.close,
      }));
    },
    enabled: !!symbol,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours cache
    retry: 2,
  });
};

// Helper to convert days to appropriate parameters
export const daysToLimit = (days: number): number => {
  if (days <= 1) return 24;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  if (days <= 90) return 90;
  if (days <= 180) return 180;
  return Math.min(days, 365);
};
