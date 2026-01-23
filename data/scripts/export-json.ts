/**
 * Export Database to JSON
 *
 * Exports price data from DuckDB to JSON files that can be served statically.
 * Run with: npx tsx data/scripts/export-json.ts
 *
 * Output:
 *   public/data/symbols.json     - List of available symbols
 *   public/data/prices/{SYMBOL}.json - Price data for each symbol
 */

import { Database } from "duckdb-async";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");
const OUTPUT_DIR = path.join(process.cwd(), "public", "data");
const PRICES_DIR = path.join(OUTPUT_DIR, "prices");

async function exportToJson() {
  console.log("🚀 Exporting database to JSON...\n");

  // Ensure output directories exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(PRICES_DIR)) {
    fs.mkdirSync(PRICES_DIR, { recursive: true });
  }

  // Connect to database
  const db = await Database.create(DB_PATH);

  // Get symbols with data
  const symbolsQuery = await db.all(`
    SELECT
      s.symbol,
      s.name,
      s.base_asset,
      COUNT(p.timestamp) as data_points,
      MIN(p.timestamp) as first_date,
      MAX(p.timestamp) as last_date
    FROM symbols s
    LEFT JOIN prices p ON s.symbol = p.symbol
    WHERE s.is_active = true
    GROUP BY s.symbol, s.name, s.base_asset
    HAVING data_points > 0
    ORDER BY s.symbol
  `);

  const symbols = (symbolsQuery as Array<{
    symbol: string;
    name: string;
    base_asset: string;
    data_points: bigint | number;
    first_date: Date | string;
    last_date: Date | string;
  }>).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    baseAsset: row.base_asset,
    dataPoints: Number(row.data_points),
    firstDate: row.first_date ? new Date(row.first_date).toISOString() : null,
    lastDate: row.last_date ? new Date(row.last_date).toISOString() : null,
  }));

  // Write symbols.json
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "symbols.json"),
    JSON.stringify({ symbols, exportedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`✅ Exported symbols.json (${symbols.length} symbols)`);

  // Export each symbol's price data
  for (const sym of symbols) {
    const pricesQuery = await db.all(
      `
      SELECT
        EPOCH_MS(timestamp) as timestamp,
        open,
        high,
        low,
        close,
        volume
      FROM prices
      WHERE symbol = ?
      ORDER BY timestamp ASC
      `,
      sym.symbol
    );

    const prices = (pricesQuery as Array<{
      timestamp: bigint | number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>).map((row) => ({
      t: Number(row.timestamp),
      o: row.open,
      h: row.high,
      l: row.low,
      c: row.close,
      v: row.volume,
    }));

    fs.writeFileSync(
      path.join(PRICES_DIR, `${sym.symbol}.json`),
      JSON.stringify({
        symbol: sym.symbol,
        name: sym.name,
        data: prices,
        exportedAt: new Date().toISOString(),
      })
    );

    console.log(`   📊 ${sym.symbol}: ${prices.length} rows`);
  }

  await db.close();

  // Show summary
  const totalSize = fs.readdirSync(PRICES_DIR).reduce((sum, file) => {
    return sum + fs.statSync(path.join(PRICES_DIR, file)).size;
  }, 0);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Export Summary:");
  console.log(`   Symbols exported: ${symbols.length}`);
  console.log(`   Total data size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
  console.log("=".repeat(50));

  console.log("\n✅ Export complete!");
  console.log("   Data is now available at /data/symbols.json and /data/prices/{SYMBOL}.json");
}

exportToJson().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
