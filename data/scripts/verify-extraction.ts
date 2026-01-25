import { Database } from 'duckdb-async';

async function verify() {
  const db = await Database.create('data/crypto-futures.duckdb');

  const res = await db.all(`
    SELECT
      interval,
      COUNT(*) as candles,
      COUNT(DISTINCT symbol) as symbols,
      ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT symbol), 0) as avg_per_symbol
    FROM futures_prices
    GROUP BY interval
    ORDER BY interval
  `);

  console.log('📊 Candles por intervalo:\n');
  console.table(res);

  const data15m = res.find(r => r.interval === '15m');
  const data5m = res.find(r => r.interval === '5m');

  if (data15m && data5m) {
    const ratio = Number(data5m.candles) / Number(data15m.candles);
    console.log(`\n🎯 Ratio 5m/15m: ${ratio.toFixed(2)}x`);
    console.log(`   Expected: 3.00x`);
    console.log(`   Status: ${ratio >= 2.9 ? '✅ CORRECTO' : '❌ FALTANTE'}`);
  }

  await db.close();
}

verify();
