/**
 * Database Statistics Script
 *
 * Shows statistics about the local DuckDB database.
 * Run with: npx tsx data/scripts/db-stats.ts
 */

import { Database } from "duckdb-async";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");

async function showStats() {
  console.log("📊 Crypto Analytics Database Statistics\n");
  console.log(`📁 Database: ${DB_PATH}`);

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.log("\n❌ Database not found!");
    console.log("   Run: npm run db:init");
    process.exit(1);
  }

  // Get file size
  const stats = fs.statSync(DB_PATH);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 File size: ${sizeMB} MB\n`);

  // Connect to database
  const db = await Database.create(DB_PATH);

  // Overall stats
  const overall = await db.all(`
    SELECT
      COUNT(DISTINCT symbol) as symbols,
      COUNT(*) as total_rows,
      MIN(timestamp) as oldest,
      MAX(timestamp) as newest
    FROM prices
  `);

  const o = overall[0] as {
    symbols: number;
    total_rows: number;
    oldest: Date | null;
    newest: Date | null;
  };

  console.log("=".repeat(60));
  console.log("Overall Statistics:");
  console.log("=".repeat(60));
  console.log(`Total symbols: ${o.symbols}`);
  console.log(`Total price rows: ${o.total_rows.toLocaleString()}`);

  if (o.oldest && o.newest) {
    console.log(`Date range: ${o.oldest} → ${o.newest}`);
    const days = Math.round(
      (new Date(o.newest).getTime() - new Date(o.oldest).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    console.log(`Days of data: ${days}`);
  }

  // Per-symbol stats
  console.log("\n" + "=".repeat(60));
  console.log("Per-Symbol Statistics:");
  console.log("=".repeat(60));
  console.log(
    "Symbol".padEnd(12) +
      "Rows".padStart(8) +
      "First".padStart(14) +
      "Last".padStart(14) +
      "Days".padStart(6)
  );
  console.log("-".repeat(60));

  const symbolStats = await db.all(`
    SELECT
      symbol,
      COUNT(*) as rows,
      MIN(timestamp) as first_date,
      MAX(timestamp) as last_date
    FROM prices
    GROUP BY symbol
    ORDER BY symbol
  `);

  for (const row of symbolStats as Array<{
    symbol: string;
    rows: number;
    first_date: Date;
    last_date: Date;
  }>) {
    const firstDate = new Date(row.first_date).toISOString().split("T")[0];
    const lastDate = new Date(row.last_date).toISOString().split("T")[0];
    const days = Math.round(
      (new Date(row.last_date).getTime() - new Date(row.first_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    console.log(
      row.symbol.padEnd(12) +
        String(row.rows).padStart(8) +
        firstDate.padStart(14) +
        lastDate.padStart(14) +
        String(days).padStart(6)
    );
  }

  // Data freshness
  console.log("\n" + "=".repeat(60));
  console.log("Data Freshness:");
  console.log("=".repeat(60));

  const freshness = await db.all(`
    SELECT
      symbol,
      MAX(timestamp) as last_update,
      DATEDIFF('day', MAX(timestamp), CURRENT_DATE) as days_old
    FROM prices
    GROUP BY symbol
    HAVING days_old > 1
    ORDER BY days_old DESC
    LIMIT 10
  `);

  if ((freshness as Array<unknown>).length === 0) {
    console.log("✅ All symbols are up to date (within 1 day)");
  } else {
    console.log("⚠️ Symbols needing update:");
    for (const row of freshness as Array<{
      symbol: string;
      last_update: Date;
      days_old: number;
    }>) {
      console.log(`   ${row.symbol}: ${row.days_old} days old`);
    }
  }

  // Sample recent data
  console.log("\n" + "=".repeat(60));
  console.log("Sample Recent Data (BTCUSDT):");
  console.log("=".repeat(60));

  const sample = await db.all(`
    SELECT timestamp, open, high, low, close, volume
    FROM prices
    WHERE symbol = 'BTCUSDT'
    ORDER BY timestamp DESC
    LIMIT 5
  `);

  if ((sample as Array<unknown>).length > 0) {
    console.log(
      "Date".padEnd(12) +
        "Open".padStart(12) +
        "High".padStart(12) +
        "Low".padStart(12) +
        "Close".padStart(12)
    );
    console.log("-".repeat(60));

    for (const row of sample as Array<{
      timestamp: Date;
      open: number;
      high: number;
      low: number;
      close: number;
    }>) {
      const date = new Date(row.timestamp).toISOString().split("T")[0];
      console.log(
        date.padEnd(12) +
          row.open.toFixed(2).padStart(12) +
          row.high.toFixed(2).padStart(12) +
          row.low.toFixed(2).padStart(12) +
          row.close.toFixed(2).padStart(12)
      );
    }
  } else {
    console.log("No data for BTCUSDT");
  }

  await db.close();
  console.log("\n✅ Done");
}

showStats().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
