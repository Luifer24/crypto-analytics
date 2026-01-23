/**
 * Database Module
 *
 * Export types and constants for use in the app.
 * Note: The DuckDB client (client.ts) is NOT exported here because
 * it uses native modules incompatible with Next.js bundler.
 * Use client.ts directly in CLI scripts only.
 */

export type {
  PriceRow,
  SymbolRow,
  PricePoint,
  OHLCVPoint,
  PriceQueryOptions,
  DbStats,
  BinanceKline,
  SupportedSymbol,
} from "./types";

export {
  SUPPORTED_SYMBOLS,
  COINGECKO_TO_BINANCE,
  BINANCE_TO_COINGECKO,
} from "./types";
