/**
 * Fetch Binance Historical Data
 *
 * Downloads OHLCV data from Binance API and stores in DuckDB.
 * Run with: npx tsx data/scripts/fetch-binance.ts
 *
 * Options:
 *   --days=N       Number of days to fetch (default: 365)
 *   --symbol=SYM   Fetch only specific symbol
 *   --all          Fetch all supported symbols
 */

import { Database } from "duckdb-async";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");
const BINANCE_API = "https://api.binance.com/api/v3";

// Rate limiting
const DELAY_MS = 100; // 100ms between requests

// Supported symbols
const SYMBOLS = [
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
];

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

/**
 * Fetch klines from Binance
 */
async function fetchKlines(
  symbol: string,
  interval: string = "1d",
  startTime?: number,
  endTime?: number,
  limit: number = 1000
): Promise<BinanceKline[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });

  if (startTime) params.append("startTime", String(startTime));
  if (endTime) params.append("endTime", String(endTime));

  const url = `${BINANCE_API}/klines?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return data.map((k: (string | number)[]) => ({
    openTime: k[0] as number,
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    closeTime: k[6] as number,
  }));
}

/**
 * Fetch all historical data for a symbol
 */
async function fetchSymbolHistory(
  symbol: string,
  days: number,
  db: Database
): Promise<number> {
  console.log(`\n📥 Fetching ${symbol} (${days} days)...`);

  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  let currentStart = startTime;
  let totalRows = 0;

  // Prepare insert statement
  const stmt = await db.prepare(`
    INSERT OR REPLACE INTO prices (symbol, timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'binance')
  `);

  while (currentStart < endTime) {
    try {
      const klines = await fetchKlines(symbol, "1d", currentStart, endTime, 1000);

      if (klines.length === 0) break;

      for (const k of klines) {
        const timestamp = new Date(k.openTime);
        await stmt.run(
          symbol,
          timestamp,
          parseFloat(k.open),
          parseFloat(k.high),
          parseFloat(k.low),
          parseFloat(k.close),
          parseFloat(k.volume)
        );
        totalRows++;
      }

      // Move to next batch
      const lastTime = klines[klines.length - 1].closeTime;
      currentStart = lastTime + 1;

      // Progress indicator
      const progress = Math.min(100, Math.round(((currentStart - startTime) / (endTime - startTime)) * 100));
      process.stdout.write(`\r   Progress: ${progress}% (${totalRows} rows)`);

      // Rate limiting
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (error) {
      console.error(`\n   ⚠️ Error fetching ${symbol}:`, error);
      break;
    }
  }

  await stmt.finalize();

  // Update symbol last_updated
  await db.run(
    "UPDATE symbols SET last_updated = CURRENT_TIMESTAMP WHERE symbol = ?",
    symbol
  );

  console.log(`\n   ✅ ${symbol}: ${totalRows} rows inserted`);
  return totalRows;
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let days = 365;
  let symbolFilter: string | null = null;

  for (const arg of args) {
    if (arg.startsWith("--days=")) {
      days = parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--symbol=")) {
      symbolFilter = arg.split("=")[1].toUpperCase();
    }
  }

  console.log("🚀 Binance Data Fetcher");
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📅 Days to fetch: ${days}`);
  console.log(`📊 Symbols: ${symbolFilter || "all"}`);

  // Connect to database
  const db = await Database.create(DB_PATH);

  // Determine which symbols to fetch
  const symbolsToFetch = symbolFilter
    ? SYMBOLS.filter((s) => s === symbolFilter)
    : SYMBOLS;

  if (symbolsToFetch.length === 0) {
    console.error(`❌ Symbol not found: ${symbolFilter}`);
    console.log(`   Available: ${SYMBOLS.join(", ")}`);
    await db.close();
    process.exit(1);
  }

  console.log(`\n📊 Fetching ${symbolsToFetch.length} symbol(s)...`);

  let totalRows = 0;
  const startTime = Date.now();

  for (let i = 0; i < symbolsToFetch.length; i++) {
    const symbol = symbolsToFetch[i];
    console.log(`\n[${i + 1}/${symbolsToFetch.length}] ${symbol}`);

    try {
      const rows = await fetchSymbolHistory(symbol, days, db);
      totalRows += rows;
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }
  }

  // Show final stats
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const stats = await db.all(`
    SELECT
      COUNT(DISTINCT symbol) as symbols,
      COUNT(*) as rows,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM prices
  `);

  const s = stats[0] as {
    symbols: number;
    rows: number;
    oldest: Date;
    newest: Date;
  };

  console.log("\n" + "=".repeat(50));
  console.log("📊 Final Statistics:");
  console.log(`   Symbols in DB: ${s.symbols}`);
  console.log(`   Total rows: ${s.rows}`);
  console.log(`   Date range: ${s.oldest} → ${s.newest}`);
  console.log(`   Rows added this run: ${totalRows}`);
  console.log(`   Time elapsed: ${elapsed}s`);
  console.log("=".repeat(50));

  await db.close();
  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
