/**
 * Export Futures Data to JSON
 *
 * Exports DuckDB futures data to static JSON files for frontend consumption.
 *
 * Output structure:
 *   public/data/futures/
 *   ├── symbols.json           - List of available symbols
 *   ├── prices/
 *   │   └── {SYMBOL}.json      - OHLCV data per symbol
 *   └── funding/
 *       └── {SYMBOL}.json      - Funding rate history per symbol
 *
 * Usage:
 *   npx tsx data/scripts/export-futures-json.ts
 */

import { Database } from "duckdb-async";
import fs from "fs/promises";
import path from "path";

// ============================================
// CONFIGURATION
// ============================================

const DB_PATH = path.join(process.cwd(), "data", "crypto-futures.duckdb");
const OUTPUT_DIR = path.join(process.cwd(), "public", "data", "futures");

// ============================================
// DATABASE
// ============================================

async function openDb(): Promise<Database> {
  return await Database.create(DB_PATH);
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

interface SymbolStats {
  symbol: string;
  baseAsset: string;
  intervals: string[];
  priceDataPoints: number;
  fundingDataPoints: number;
  firstDate: string | null;
  lastDate: string | null;
}

async function getSymbolStats(db: Database): Promise<SymbolStats[]> {
  // Get price stats per symbol
  const priceStats = await db.all(`
    SELECT
      symbol,
      interval,
      COUNT(*) as count,
      MIN(timestamp) as first_date,
      MAX(timestamp) as last_date
    FROM futures_prices
    GROUP BY symbol, interval
    ORDER BY symbol, interval
  `);

  // Get funding stats per symbol
  const fundingStats = await db.all(`
    SELECT
      symbol,
      COUNT(*) as count
    FROM funding_rates
    GROUP BY symbol
  `);

  // Combine stats
  const symbolMap = new Map<string, SymbolStats>();

  for (const row of priceStats as any[]) {
    const symbol = row.symbol;
    if (!symbolMap.has(symbol)) {
      symbolMap.set(symbol, {
        symbol,
        baseAsset: symbol.replace("USDT", ""),
        intervals: [],
        priceDataPoints: 0,
        fundingDataPoints: 0,
        firstDate: null,
        lastDate: null,
      });
    }
    const stats = symbolMap.get(symbol)!;
    stats.intervals.push(row.interval);
    stats.priceDataPoints += Number(row.count);

    const firstDate = row.first_date ? new Date(row.first_date).toISOString() : null;
    const lastDate = row.last_date ? new Date(row.last_date).toISOString() : null;

    if (!stats.firstDate || (firstDate && firstDate < stats.firstDate)) {
      stats.firstDate = firstDate;
    }
    if (!stats.lastDate || (lastDate && lastDate > stats.lastDate)) {
      stats.lastDate = lastDate;
    }
  }

  for (const row of fundingStats as any[]) {
    const stats = symbolMap.get(row.symbol);
    if (stats) {
      stats.fundingDataPoints = Number(row.count);
    }
  }

  return Array.from(symbolMap.values());
}

async function exportPrices(db: Database, symbol: string, outputDir: string): Promise<number> {
  const rows = await db.all(`
    SELECT
      EPOCH_MS(timestamp) as t,
      interval as i,
      open as o,
      high as h,
      low as l,
      close as c,
      volume as v,
      quote_volume as qv
    FROM futures_prices
    WHERE symbol = ?
    ORDER BY timestamp ASC
  `, symbol);

  if (rows.length === 0) return 0;

  const data = {
    symbol,
    exportedAt: new Date().toISOString(),
    count: rows.length,
    data: rows.map((r: any) => ({
      t: Number(r.t),
      i: r.i,
      o: r.o,
      h: r.h,
      l: r.l,
      c: r.c,
      v: r.v,
      qv: r.qv,
    })),
  };

  const filePath = path.join(outputDir, "prices", `${symbol}.json`);
  await fs.writeFile(filePath, JSON.stringify(data));

  return rows.length;
}

async function exportFunding(db: Database, symbol: string, outputDir: string): Promise<number> {
  const rows = await db.all(`
    SELECT
      EPOCH_MS(funding_time) as t,
      funding_rate as rate,
      mark_price as mark
    FROM funding_rates
    WHERE symbol = ?
    ORDER BY funding_time ASC
  `, symbol);

  if (rows.length === 0) return 0;

  const data = {
    symbol,
    exportedAt: new Date().toISOString(),
    count: rows.length,
    data: rows.map((r: any) => ({
      t: Number(r.t),
      rate: r.rate,
      mark: r.mark,
    })),
  };

  const filePath = path.join(outputDir, "funding", `${symbol}.json`);
  await fs.writeFile(filePath, JSON.stringify(data));

  return rows.length;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log("📦 Exporting Futures Data to JSON\n");

  // Check if database exists
  try {
    await fs.access(DB_PATH);
  } catch {
    console.error(`❌ Database not found: ${DB_PATH}`);
    console.error("   Run 'npm run db:futures' first to fetch data.");
    process.exit(1);
  }

  const db = await openDb();

  // Create output directories
  await fs.mkdir(path.join(OUTPUT_DIR, "prices"), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, "funding"), { recursive: true });

  // Get symbol stats
  console.log("📊 Analyzing database...");
  const symbolStats = await getSymbolStats(db);
  console.log(`   Found ${symbolStats.length} symbols\n`);

  if (symbolStats.length === 0) {
    console.log("⚠️  No data to export. Run 'npm run db:futures' first.");
    await db.close();
    return;
  }

  // Export symbols.json
  const symbolsData = {
    exportedAt: new Date().toISOString(),
    count: symbolStats.length,
    symbols: symbolStats,
  };
  await fs.writeFile(
    path.join(OUTPUT_DIR, "symbols.json"),
    JSON.stringify(symbolsData, null, 2)
  );
  console.log(`✅ Exported symbols.json (${symbolStats.length} symbols)\n`);

  // Export prices
  console.log("📈 Exporting price data...");
  let totalPrices = 0;
  for (let i = 0; i < symbolStats.length; i++) {
    const symbol = symbolStats[i].symbol;
    process.stdout.write(`   [${i + 1}/${symbolStats.length}] ${symbol}... `);
    const count = await exportPrices(db, symbol, OUTPUT_DIR);
    console.log(`${count.toLocaleString()} rows`);
    totalPrices += count;
  }
  console.log(`✅ Total: ${totalPrices.toLocaleString()} price records\n`);

  // Export funding rates
  console.log("💰 Exporting funding rates...");
  let totalFunding = 0;
  for (let i = 0; i < symbolStats.length; i++) {
    const symbol = symbolStats[i].symbol;
    process.stdout.write(`   [${i + 1}/${symbolStats.length}] ${symbol}... `);
    const count = await exportFunding(db, symbol, OUTPUT_DIR);
    console.log(`${count.toLocaleString()} rows`);
    totalFunding += count;
  }
  console.log(`✅ Total: ${totalFunding.toLocaleString()} funding records\n`);

  await db.close();

  // Summary
  console.log("═".repeat(50));
  console.log("✅ Export complete!");
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`📊 ${symbolStats.length} symbols`);
  console.log(`📈 ${totalPrices.toLocaleString()} price records`);
  console.log(`💰 ${totalFunding.toLocaleString()} funding records`);
}

main().catch(console.error);
