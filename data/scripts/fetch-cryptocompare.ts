/**
 * Fetch CryptoCompare Historical Data
 *
 * Downloads OHLCV data from CryptoCompare API and stores in DuckDB.
 * Run with: npx tsx data/scripts/fetch-cryptocompare.ts
 *
 * Options:
 *   --days=N       Number of days to fetch (default: 365)
 *   --symbol=SYM   Fetch only specific symbol (e.g., BTC)
 */

import { Database } from "duckdb-async";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");
const CRYPTOCOMPARE_API = "https://min-api.cryptocompare.com/data/v2";

// Rate limiting - CryptoCompare allows ~100 req/min on free tier
const DELAY_MS = 700; // 700ms between requests to be safe

// Supported symbols (CryptoCompare format)
const SYMBOLS = [
  { symbol: "BTCUSDT", cc: "BTC", name: "Bitcoin" },
  { symbol: "ETHUSDT", cc: "ETH", name: "Ethereum" },
  { symbol: "BNBUSDT", cc: "BNB", name: "BNB" },
  { symbol: "SOLUSDT", cc: "SOL", name: "Solana" },
  { symbol: "XRPUSDT", cc: "XRP", name: "XRP" },
  { symbol: "ADAUSDT", cc: "ADA", name: "Cardano" },
  { symbol: "DOGEUSDT", cc: "DOGE", name: "Dogecoin" },
  { symbol: "DOTUSDT", cc: "DOT", name: "Polkadot" },
  { symbol: "AVAXUSDT", cc: "AVAX", name: "Avalanche" },
  { symbol: "LINKUSDT", cc: "LINK", name: "Chainlink" },
  { symbol: "MATICUSDT", cc: "MATIC", name: "Polygon" },
  { symbol: "LTCUSDT", cc: "LTC", name: "Litecoin" },
  { symbol: "UNIUSDT", cc: "UNI", name: "Uniswap" },
  { symbol: "XLMUSDT", cc: "XLM", name: "Stellar" },
  { symbol: "XMRUSDT", cc: "XMR", name: "Monero" },
  { symbol: "ETCUSDT", cc: "ETC", name: "Ethereum Classic" },
  { symbol: "FILUSDT", cc: "FIL", name: "Filecoin" },
  { symbol: "ATOMUSDT", cc: "ATOM", name: "Cosmos" },
  { symbol: "TRXUSDT", cc: "TRX", name: "Tron" },
  { symbol: "NEARUSDT", cc: "NEAR", name: "NEAR Protocol" },
  { symbol: "ALGOUSDT", cc: "ALGO", name: "Algorand" },
  { symbol: "FTMUSDT", cc: "FTM", name: "Fantom" },
  { symbol: "APTUSDT", cc: "APT", name: "Aptos" },
  { symbol: "ARBUSDT", cc: "ARB", name: "Arbitrum" },
  { symbol: "OPUSDT", cc: "OP", name: "Optimism" },
  { symbol: "SUIUSDT", cc: "SUI", name: "Sui" },
  { symbol: "PEPEUSDT", cc: "PEPE", name: "Pepe" },
  { symbol: "SHIBUSDT", cc: "SHIB", name: "Shiba Inu" },
];

interface CryptoCompareOHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumefrom: number;
  volumeto: number;
}

/**
 * Fetch daily OHLCV from CryptoCompare
 */
async function fetchHistoDay(
  symbol: string,
  limit: number = 365,
  toTs?: number
): Promise<CryptoCompareOHLC[]> {
  const params = new URLSearchParams({
    fsym: symbol,
    tsym: "USD",
    limit: String(Math.min(limit, 2000)), // CryptoCompare max is 2000
  });

  if (toTs) {
    params.append("toTs", String(toTs));
  }

  const url = `${CRYPTOCOMPARE_API}/histoday?${params}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.Response !== "Success") {
    throw new Error(data.Message || "Failed to fetch data");
  }

  return data.Data.Data;
}

/**
 * Fetch all historical data for a symbol
 */
async function fetchSymbolHistory(
  symbolInfo: { symbol: string; cc: string; name: string },
  days: number,
  db: Database
): Promise<number> {
  console.log(`\n📥 Fetching ${symbolInfo.name} (${symbolInfo.cc}) - ${days} days...`);

  // Prepare insert statement
  const stmt = await db.prepare(`
    INSERT OR REPLACE INTO prices (symbol, timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'cryptocompare')
  `);

  let totalRows = 0;
  let toTs: number | undefined = undefined;
  let daysRemaining = days;

  while (daysRemaining > 0) {
    const fetchLimit = Math.min(daysRemaining, 2000);

    try {
      const ohlcData = await fetchHistoDay(symbolInfo.cc, fetchLimit, toTs);

      if (ohlcData.length === 0) break;

      for (const candle of ohlcData) {
        // Skip if close is 0 (no data)
        if (candle.close === 0) continue;

        const timestamp = new Date(candle.time * 1000);
        await stmt.run(
          symbolInfo.symbol,
          timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volumefrom
        );
        totalRows++;
      }

      // Move to earlier data
      toTs = ohlcData[0].time - 1;
      daysRemaining -= ohlcData.length;

      // Progress indicator
      const progress = Math.round(((days - daysRemaining) / days) * 100);
      process.stdout.write(`\r   Progress: ${progress}% (${totalRows} rows)`);

      // If we got less than requested, we've hit the end
      if (ohlcData.length < fetchLimit) break;

      // Rate limiting
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (error) {
      console.error(`\n   ⚠️ Error:`, error);
      break;
    }
  }

  await stmt.finalize();

  // Update symbol last_updated
  await db.run(
    "UPDATE symbols SET last_updated = CURRENT_TIMESTAMP WHERE symbol = ?",
    symbolInfo.symbol
  );

  console.log(`\n   ✅ ${symbolInfo.symbol}: ${totalRows} rows inserted`);
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

  console.log("🚀 CryptoCompare Data Fetcher");
  console.log(`📁 Database: ${DB_PATH}`);
  console.log(`📅 Days to fetch: ${days}`);
  console.log(`📊 Symbol filter: ${symbolFilter || "all"}`);

  // Connect to database
  const db = await Database.create(DB_PATH);

  // Determine which symbols to fetch
  const symbolsToFetch = symbolFilter
    ? SYMBOLS.filter((s) => s.cc === symbolFilter || s.symbol === symbolFilter)
    : SYMBOLS;

  if (symbolsToFetch.length === 0) {
    console.error(`❌ Symbol not found: ${symbolFilter}`);
    console.log(`   Available: ${SYMBOLS.map((s) => s.cc).join(", ")}`);
    await db.close();
    process.exit(1);
  }

  console.log(`\n📊 Fetching ${symbolsToFetch.length} symbol(s)...`);
  console.log(`⏱️ Estimated time: ~${Math.ceil((symbolsToFetch.length * DELAY_MS) / 1000 / 60)} minutes`);

  let totalRows = 0;
  const startTime = Date.now();

  for (let i = 0; i < symbolsToFetch.length; i++) {
    const symbolInfo = symbolsToFetch[i];
    console.log(`\n[${i + 1}/${symbolsToFetch.length}] ${symbolInfo.name}`);

    try {
      const rows = await fetchSymbolHistory(symbolInfo, days, db);
      totalRows += rows;
    } catch (error) {
      console.error(`   ❌ Failed: ${error}`);
    }

    // Rate limiting between symbols
    if (i < symbolsToFetch.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
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
  console.log(`   Total rows: ${s.rows.toLocaleString()}`);
  if (s.oldest && s.newest) {
    console.log(`   Date range: ${s.oldest} → ${s.newest}`);
  }
  console.log(`   Rows added this run: ${totalRows.toLocaleString()}`);
  console.log(`   Time elapsed: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log("=".repeat(50));

  await db.close();
  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
