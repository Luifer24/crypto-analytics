/**
 * Fetch Binance Futures Data (Optimized)
 *
 * Downloads historical data from Binance FAPI with batch inserts.
 *
 * Usage:
 *   npx tsx data/scripts/fetch-binance-futures.ts [--days=90] [--interval=15m] [--all]
 */

import { Database } from "duckdb-async";
import path from "path";

// ============================================
// CONFIGURATION
// ============================================

const DB_PATH = path.join(process.cwd(), "data", "crypto-futures.duckdb");
const BASE_URL = "https://fapi.binance.com";

// Rate limiting
const DELAY_MS = 100;
const MAX_KLINES_PER_REQUEST = 1500;
const BATCH_SIZE = 5000; // Insert in batches for performance

// Top 50 established futures symbols
const FUTURES_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT",
  "MATICUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", "ETCUSDT",
  "FILUSDT", "APTUSDT", "ARBUSDT", "OPUSDT", "NEARUSDT",
  "FTMUSDT", "ALGOUSDT", "XLMUSDT", "XMRUSDT", "TRXUSDT",
  "AAVEUSDT", "MKRUSDT", "SNXUSDT", "COMPUSDT", "CRVUSDT",
  "LDOUSDT", "GMXUSDT", "DYDXUSDT", "INJUSDT", "RUNEUSDT",
  "RENDERUSDT", "GRTUSDT", "FETUSDT", "SANDUSDT", "MANAUSDT",
  "AXSUSDT", "GALAUSDT", "IMXUSDT", "SUIUSDT", "SEIUSDT",
  "TIAUSDT", "JUPUSDT", "WLDUSDT", "STXUSDT", "ICPUSDT",
] as const;

// Parse arguments
const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith("--days="));
const intervalArg = args.find(a => a.startsWith("--interval="));
const allFlag = args.includes("--all");

const DAYS = allFlag ? 2000 : (daysArg ? parseInt(daysArg.split("=")[1]) : 90);
const INTERVAL = intervalArg ? intervalArg.split("=")[1] : "15m"; // Default 15m

// ============================================
// DATABASE
// ============================================

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.create(DB_PATH);
    await initSchema();
  }
  return db;
}

async function initSchema(): Promise<void> {
  const database = await getDb();

  await database.run(`
    CREATE TABLE IF NOT EXISTS futures_prices (
      symbol VARCHAR NOT NULL,
      timestamp TIMESTAMP NOT NULL,
      interval VARCHAR NOT NULL,
      open DOUBLE,
      high DOUBLE,
      low DOUBLE,
      close DOUBLE,
      volume DOUBLE,
      quote_volume DOUBLE,
      PRIMARY KEY (symbol, timestamp, interval)
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS funding_rates (
      symbol VARCHAR NOT NULL,
      funding_time TIMESTAMP NOT NULL,
      funding_rate DOUBLE,
      mark_price DOUBLE,
      PRIMARY KEY (symbol, funding_time)
    )
  `);

  console.log("✅ Schema initialized");
}

// ============================================
// API FUNCTIONS
// ============================================

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.log("⚠️  Rate limited, waiting 60s...");
          await sleep(60000);
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(2000 * (i + 1));
    }
  }
}

// ============================================
// BATCH INSERT (OPTIMIZED)
// ============================================

interface KlineData {
  symbol: string;
  timestamp: Date;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
}

async function batchInsertKlines(data: KlineData[]): Promise<void> {
  if (data.length === 0) return;

  const database = await getDb();

  // Build VALUES string
  const values = data.map(k =>
    `('${k.symbol}', '${k.timestamp.toISOString()}', '${k.interval}', ${k.open}, ${k.high}, ${k.low}, ${k.close}, ${k.volume}, ${k.quoteVolume})`
  ).join(",\n");

  await database.run(`
    INSERT OR REPLACE INTO futures_prices
    (symbol, timestamp, interval, open, high, low, close, volume, quote_volume)
    VALUES ${values}
  `);
}

interface FundingData {
  symbol: string;
  fundingTime: Date;
  fundingRate: number;
  markPrice: number;
}

async function batchInsertFunding(data: FundingData[]): Promise<void> {
  if (data.length === 0) return;

  const database = await getDb();

  const values = data.map(f =>
    `('${f.symbol}', '${f.fundingTime.toISOString()}', ${f.fundingRate}, ${f.markPrice})`
  ).join(",\n");

  await database.run(`
    INSERT OR REPLACE INTO funding_rates
    (symbol, funding_time, funding_rate, mark_price)
    VALUES ${values}
  `);
}

// ============================================
// DATA EXTRACTION
// ============================================

const intervalMs: Record<string, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

async function extractKlinesForSymbol(
  symbol: string,
  interval: string,
  days: number
): Promise<number> {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);
  const step = MAX_KLINES_PER_REQUEST * (intervalMs[interval] || intervalMs["15m"]);

  let totalInserted = 0;
  let currentStart = startTime;
  let batch: KlineData[] = [];

  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + step, endTime);

    try {
      const url = `${BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStart}&endTime=${currentEnd}&limit=${MAX_KLINES_PER_REQUEST}`;
      const klines = await fetchWithRetry(url);

      if (klines && klines.length > 0) {
        for (const k of klines) {
          batch.push({
            symbol,
            timestamp: new Date(k[0]),
            interval,
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            quoteVolume: parseFloat(k[7]),
          });
        }

        // Flush batch when large enough
        if (batch.length >= BATCH_SIZE) {
          await batchInsertKlines(batch);
          totalInserted += batch.length;
          batch = [];
        }
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error}`);
    }

    currentStart = currentEnd;
    await sleep(DELAY_MS);
  }

  // Flush remaining
  if (batch.length > 0) {
    await batchInsertKlines(batch);
    totalInserted += batch.length;
  }

  return totalInserted;
}

async function extractFundingRatesForSymbol(
  symbol: string,
  days: number
): Promise<number> {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);

  try {
    const url = `${BASE_URL}/fapi/v1/fundingRate?symbol=${symbol}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
    const rates = await fetchWithRetry(url);

    if (rates && rates.length > 0) {
      const data: FundingData[] = rates.map((r: any) => ({
        symbol: r.symbol,
        fundingTime: new Date(r.fundingTime),
        fundingRate: parseFloat(r.fundingRate),
        markPrice: parseFloat(r.markPrice || "0"),
      }));

      await batchInsertFunding(data);
      return data.length;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error}`);
  }

  return 0;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("🚀 Binance Futures Data Extraction (Optimized)");
  console.log(`📊 Symbols: ${FUTURES_SYMBOLS.length}`);
  console.log(`📅 Days: ${DAYS}`);
  console.log(`⏱️  Interval: ${INTERVAL}`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log("");

  const startTime = Date.now();
  await getDb();

  // Check available symbols
  console.log("🔍 Checking available symbols...");
  const exchangeInfo = await fetchWithRetry(`${BASE_URL}/fapi/v1/exchangeInfo`);
  const availableSymbols = new Set(
    exchangeInfo.symbols
      .filter((s: any) => s.status === "TRADING")
      .map((s: any) => s.symbol)
  );

  const validSymbols = FUTURES_SYMBOLS.filter(s => availableSymbols.has(s));
  console.log(`✅ ${validSymbols.length}/${FUTURES_SYMBOLS.length} symbols available\n`);

  // Extract OHLCV
  console.log(`📈 Fetching ${INTERVAL} OHLCV data...`);
  let totalKlines = 0;
  for (let i = 0; i < validSymbols.length; i++) {
    const symbol = validSymbols[i];
    const symbolStart = Date.now();
    process.stdout.write(`  [${i + 1}/${validSymbols.length}] ${symbol}... `);

    const count = await extractKlinesForSymbol(symbol, INTERVAL, DAYS);
    const elapsed = ((Date.now() - symbolStart) / 1000).toFixed(1);
    console.log(`${count.toLocaleString()} candles (${elapsed}s)`);
    totalKlines += count;
  }
  console.log(`✅ Total: ${totalKlines.toLocaleString()} candles\n`);

  // Extract funding rates
  console.log("💰 Fetching funding rates...");
  let totalFunding = 0;
  for (let i = 0; i < validSymbols.length; i++) {
    const symbol = validSymbols[i];
    process.stdout.write(`  [${i + 1}/${validSymbols.length}] ${symbol}... `);
    const count = await extractFundingRatesForSymbol(symbol, DAYS);
    console.log(`${count} rates`);
    totalFunding += count;
    await sleep(DELAY_MS);
  }
  console.log(`✅ Total: ${totalFunding.toLocaleString()} funding rates\n`);

  await db?.close();

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("═".repeat(50));
  console.log(`✅ Complete in ${elapsed} minutes`);
  console.log(`📊 ${totalKlines.toLocaleString()} price candles`);
  console.log(`💰 ${totalFunding.toLocaleString()} funding rates`);
  console.log(`💾 Saved to: ${DB_PATH}`);
}

main().catch(console.error);
