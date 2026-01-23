/**
 * Initialize Database Script
 *
 * Creates the DuckDB database and schema.
 * Run with: npx tsx data/scripts/init-db.ts
 */

import { Database } from "duckdb-async";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "crypto.duckdb");

async function initDatabase() {
  console.log("🚀 Initializing crypto database...");
  console.log(`📁 Database path: ${DB_PATH}`);

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📂 Created data directory: ${dataDir}`);
  }

  // Create database
  const db = await Database.create(DB_PATH);
  console.log("✅ Database created");

  // Create prices table
  await db.run(`
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
  console.log("✅ Created prices table");

  // Create symbols table
  await db.run(`
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
  console.log("✅ Created symbols table");

  // Create indexes
  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_prices_symbol_time
    ON prices(symbol, timestamp)
  `);
  console.log("✅ Created indexes");

  // Insert default symbols
  const symbols = [
    { symbol: "BTCUSDT", name: "Bitcoin", base: "BTC" },
    { symbol: "ETHUSDT", name: "Ethereum", base: "ETH" },
    { symbol: "BNBUSDT", name: "BNB", base: "BNB" },
    { symbol: "SOLUSDT", name: "Solana", base: "SOL" },
    { symbol: "XRPUSDT", name: "XRP", base: "XRP" },
    { symbol: "ADAUSDT", name: "Cardano", base: "ADA" },
    { symbol: "DOGEUSDT", name: "Dogecoin", base: "DOGE" },
    { symbol: "DOTUSDT", name: "Polkadot", base: "DOT" },
    { symbol: "AVAXUSDT", name: "Avalanche", base: "AVAX" },
    { symbol: "LINKUSDT", name: "Chainlink", base: "LINK" },
    { symbol: "MATICUSDT", name: "Polygon", base: "MATIC" },
    { symbol: "LTCUSDT", name: "Litecoin", base: "LTC" },
    { symbol: "UNIUSDT", name: "Uniswap", base: "UNI" },
    { symbol: "XLMUSDT", name: "Stellar", base: "XLM" },
    { symbol: "XMRUSDT", name: "Monero", base: "XMR" },
    { symbol: "ETCUSDT", name: "Ethereum Classic", base: "ETC" },
    { symbol: "FILUSDT", name: "Filecoin", base: "FIL" },
    { symbol: "ATOMUSDT", name: "Cosmos", base: "ATOM" },
    { symbol: "TRXUSDT", name: "Tron", base: "TRX" },
    { symbol: "NEARUSDT", name: "NEAR Protocol", base: "NEAR" },
    { symbol: "ALGOUSDT", name: "Algorand", base: "ALGO" },
    { symbol: "FTMUSDT", name: "Fantom", base: "FTM" },
    { symbol: "APTUSDT", name: "Aptos", base: "APT" },
    { symbol: "ARBUSDT", name: "Arbitrum", base: "ARB" },
    { symbol: "OPUSDT", name: "Optimism", base: "OP" },
    { symbol: "SUIUSDT", name: "Sui", base: "SUI" },
    { symbol: "PEPEUSDT", name: "Pepe", base: "PEPE" },
    { symbol: "SHIBUSDT", name: "Shiba Inu", base: "SHIB" },
  ];

  const stmt = await db.prepare(`
    INSERT OR REPLACE INTO symbols (symbol, name, base_asset, quote_asset, exchange, is_active, last_updated)
    VALUES (?, ?, ?, 'USDT', 'binance', true, CURRENT_TIMESTAMP)
  `);

  for (const sym of symbols) {
    await stmt.run(sym.symbol, sym.name, sym.base);
  }
  await stmt.finalize();
  console.log(`✅ Inserted ${symbols.length} symbols`);

  // Show stats
  const priceCount = await db.all("SELECT COUNT(*) as count FROM prices");
  const symbolCount = await db.all("SELECT COUNT(*) as count FROM symbols");

  console.log("\n📊 Database Statistics:");
  console.log(`   Symbols: ${(symbolCount[0] as { count: number }).count}`);
  console.log(`   Price rows: ${(priceCount[0] as { count: number }).count}`);

  await db.close();
  console.log("\n✅ Database initialization complete!");
  console.log("\n📌 Next step: Run fetch-binance.ts to populate price data");
}

initDatabase().catch((error) => {
  console.error("❌ Error initializing database:", error);
  process.exit(1);
});
