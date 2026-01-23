/**
 * Database Types for Crypto Analytics
 *
 * TypeScript types for DuckDB tables and queries.
 */

/**
 * OHLCV price data point
 */
export interface PriceRow {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source: string;
}

/**
 * Symbol metadata
 */
export interface SymbolRow {
  symbol: string;
  name: string | null;
  base_asset: string;
  quote_asset: string;
  exchange: string;
  is_active: boolean;
  last_updated: Date | null;
}

/**
 * Price data for analysis (simplified)
 */
export interface PricePoint {
  timestamp: number; // Unix timestamp in ms
  price: number;     // Close price
}

/**
 * OHLCV data for charting
 */
export interface OHLCVPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Query options for price data
 */
export interface PriceQueryOptions {
  symbol: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  interval?: "1d" | "1h" | "4h";
}

/**
 * Binance kline response
 */
export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

/**
 * Database statistics
 */
export interface DbStats {
  totalSymbols: number;
  totalPriceRows: number;
  oldestData: Date | null;
  newestData: Date | null;
  symbolStats: Array<{
    symbol: string;
    rowCount: number;
    firstDate: Date;
    lastDate: Date;
  }>;
}

/**
 * Supported crypto symbols for initial fetch
 */
export const SUPPORTED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "XLMUSDT",
  "XMRUSDT",
  "ETCUSDT",
  "FILUSDT",
  "ATOMUSDT",
  "TRXUSDT",
  "NEARUSDT",
  "ALGOUSDT",
  "FTMUSDT",
  "APTUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "SHIBUSDT",
] as const;

export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

/**
 * Map from CoinGecko IDs to Binance symbols
 */
export const COINGECKO_TO_BINANCE: Record<string, string> = {
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
 * Map from Binance symbols to CoinGecko IDs
 */
export const BINANCE_TO_COINGECKO: Record<string, string> = Object.fromEntries(
  Object.entries(COINGECKO_TO_BINANCE).map(([k, v]) => [v, k])
);
