/**
 * DuckDB Client for Crypto Analytics
 *
 * Provides a typed interface to the local DuckDB database.
 * Used for storing and querying historical price data.
 */

import { Database } from "duckdb-async";
import path from "path";
import type {
  PriceRow,
  SymbolRow,
  PricePoint,
  OHLCVPoint,
  PriceQueryOptions,
  DbStats,
} from "./types";

// Database file path
const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");

// Singleton database instance
let db: Database | null = null;

/**
 * Get or create the database connection
 */
export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.create(DB_PATH);
  }
  return db;
}

/**
 * Close the database connection
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

/**
 * Initialize the database schema
 */
export async function initSchema(): Promise<void> {
  const database = await getDb();

  // Create prices table
  await database.run(`
    CREATE TABLE IF NOT EXISTS prices (
      symbol VARCHAR NOT NULL,
      timestamp TIMESTAMP NOT NULL,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      source VARCHAR DEFAULT 'binance',
      PRIMARY KEY (symbol, timestamp)
    )
  `);

  // Create symbols table
  await database.run(`
    CREATE TABLE IF NOT EXISTS symbols (
      symbol VARCHAR PRIMARY KEY,
      name VARCHAR,
      base_asset VARCHAR,
      quote_asset VARCHAR,
      exchange VARCHAR DEFAULT 'binance',
      is_active BOOLEAN DEFAULT true,
      last_updated TIMESTAMP
    )
  `);

  // Create index for faster queries
  await database.run(`
    CREATE INDEX IF NOT EXISTS idx_prices_symbol_time
    ON prices(symbol, timestamp)
  `);

  console.log("Database schema initialized");
}

/**
 * Insert price data (bulk insert)
 */
export async function insertPrices(prices: Omit<PriceRow, "source">[], source = "binance"): Promise<number> {
  if (prices.length === 0) return 0;

  const database = await getDb();

  // Prepare the insert statement
  const stmt = await database.prepare(`
    INSERT OR REPLACE INTO prices (symbol, timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const price of prices) {
    await stmt.run(
      price.symbol,
      price.timestamp,
      price.open,
      price.high,
      price.low,
      price.close,
      price.volume,
      source
    );
    inserted++;
  }

  await stmt.finalize();
  return inserted;
}

/**
 * Get price history for a symbol
 */
export async function getPrices(options: PriceQueryOptions): Promise<PricePoint[]> {
  const database = await getDb();

  let query = `
    SELECT
      EPOCH_MS(timestamp) as timestamp,
      close as price
    FROM prices
    WHERE symbol = ?
  `;

  const params: (string | Date | number)[] = [options.symbol];

  if (options.startDate) {
    query += " AND timestamp >= ?";
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += " AND timestamp <= ?";
    params.push(options.endDate);
  }

  query += " ORDER BY timestamp ASC";

  if (options.limit) {
    query += " LIMIT ?";
    params.push(options.limit);
  }

  const rows = await database.all(query, ...params);

  return rows.map((row: { timestamp: number; price: number }) => ({
    timestamp: row.timestamp,
    price: row.price,
  }));
}

/**
 * Get OHLCV data for a symbol
 */
export async function getOHLCV(options: PriceQueryOptions): Promise<OHLCVPoint[]> {
  const database = await getDb();

  let query = `
    SELECT
      EPOCH_MS(timestamp) as timestamp,
      open,
      high,
      low,
      close,
      volume
    FROM prices
    WHERE symbol = ?
  `;

  const params: (string | Date | number)[] = [options.symbol];

  if (options.startDate) {
    query += " AND timestamp >= ?";
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += " AND timestamp <= ?";
    params.push(options.endDate);
  }

  query += " ORDER BY timestamp ASC";

  if (options.limit) {
    query += " LIMIT ?";
    params.push(options.limit);
  }

  const rows = await database.all(query, ...params);

  return rows.map((row: OHLCVPoint) => ({
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

/**
 * Get close prices only (for cointegration analysis)
 */
export async function getClosePrices(
  symbol: string,
  days: number
): Promise<number[]> {
  const database = await getDb();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const rows = await database.all(
    `
    SELECT close
    FROM prices
    WHERE symbol = ?
      AND timestamp >= ?
    ORDER BY timestamp ASC
    `,
    symbol,
    startDate
  );

  return rows.map((row: { close: number }) => row.close);
}

/**
 * Get all available symbols
 */
export async function getSymbols(): Promise<SymbolRow[]> {
  const database = await getDb();

  const rows = await database.all(`
    SELECT * FROM symbols WHERE is_active = true
  `);

  return rows as SymbolRow[];
}

/**
 * Insert or update a symbol
 */
export async function upsertSymbol(symbol: Partial<SymbolRow> & { symbol: string }): Promise<void> {
  const database = await getDb();

  await database.run(
    `
    INSERT OR REPLACE INTO symbols (symbol, name, base_asset, quote_asset, exchange, is_active, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    symbol.symbol,
    symbol.name || null,
    symbol.base_asset || symbol.symbol.replace("USDT", ""),
    symbol.quote_asset || "USDT",
    symbol.exchange || "binance",
    symbol.is_active ?? true,
    symbol.last_updated || new Date()
  );
}

/**
 * Get database statistics
 */
export async function getDbStats(): Promise<DbStats> {
  const database = await getDb();

  // Total symbols
  const symbolCount = await database.all("SELECT COUNT(*) as count FROM symbols");
  const totalSymbols = (symbolCount[0] as { count: number }).count;

  // Total price rows
  const priceCount = await database.all("SELECT COUNT(*) as count FROM prices");
  const totalPriceRows = (priceCount[0] as { count: number }).count;

  // Date range
  const dateRange = await database.all(`
    SELECT
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM prices
  `);

  const { oldest, newest } = dateRange[0] as { oldest: Date | null; newest: Date | null };

  // Per-symbol stats
  const symbolStats = await database.all(`
    SELECT
      symbol,
      COUNT(*) as row_count,
      MIN(timestamp) as first_date,
      MAX(timestamp) as last_date
    FROM prices
    GROUP BY symbol
    ORDER BY symbol
  `);

  return {
    totalSymbols,
    totalPriceRows,
    oldestData: oldest,
    newestData: newest,
    symbolStats: symbolStats.map((row: {
      symbol: string;
      row_count: number;
      first_date: Date;
      last_date: Date;
    }) => ({
      symbol: row.symbol,
      rowCount: row.row_count,
      firstDate: row.first_date,
      lastDate: row.last_date,
    })),
  };
}

/**
 * Check if we have data for a symbol
 */
export async function hasData(symbol: string, minDays = 30): Promise<boolean> {
  const database = await getDb();

  const result = await database.all(
    `
    SELECT COUNT(*) as count
    FROM prices
    WHERE symbol = ?
      AND timestamp >= CURRENT_DATE - INTERVAL ? DAY
    `,
    symbol,
    minDays
  );

  return (result[0] as { count: number }).count >= minDays;
}

/**
 * Delete old data (cleanup)
 */
export async function deleteOldData(olderThanDays: number): Promise<number> {
  const database = await getDb();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await database.run(
    "DELETE FROM prices WHERE timestamp < ?",
    cutoffDate
  );

  return result.changes || 0;
}
