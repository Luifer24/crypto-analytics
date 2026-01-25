# Fuentes de Datos - crypto-analytics

**Última actualización:** Enero 2026

---

## 📊 Resumen Ejecutivo

crypto-analytics utiliza **2 fuentes principales de datos** dependiendo de la herramienta:

| Herramienta | Spot Data | Futures Data |
|-------------|-----------|--------------|
| **COMPARE** | 🌐 CryptoCompare API (live) | ❌ No disponible |
| **SCANNER** | 💾 JSON Local (static) | 💾 JSON Local (static) |
| **BACKTEST** | 💾 JSON Local (static) | 💾 JSON Local (static) |
| **FUNDING** | ❌ No aplica | 💾 JSON Local (static) |

---

## 🔍 Detalle por Herramienta

### **1. COMPARE (/compare)**

#### Fuente de Datos: **CryptoCompare API** 🌐

**Hook utilizado:** `useCryptoComparePriceHistory`

**Endpoint:**
```
https://min-api.cryptocompare.com/data/v2/histoday
```

**Características:**
- ✅ **Datos en vivo** - Siempre actualizados
- ✅ **Sin necesidad de extracción** - API directa
- ⚠️ **Rate limits** - 200ms entre llamadas
- ⚠️ **Solo Spot** - No soporta Futures
- ⚠️ **Símbolos limitados** - ~50 principales cryptos

**Ejemplo de llamada:**
```
GET /histoday?fsym=ETHUSDT&tsym=USD&limit=90
```

**Por qué esta fuente:**
- Compare es para validación rápida de hipótesis
- No necesitas descargar todo un dataset
- Datos siempre frescos para análisis puntual

---

### **2. SCANNER (/scanner)**

#### Fuente de Datos: **JSON Local** 💾

**Hooks utilizados:**
- `useLocalPairScanner` (Spot)
- `useFuturesPairScanner` (Futures)

**Ubicación de archivos:**

```
public/data/
├── symbols.json              # Lista de símbolos Spot
├── prices/                   # Datos Spot
│   ├── BTCUSDT.json
│   ├── ETHUSDT.json
│   └── ... (28 símbolos)
└── futures/                  # Datos Futures
    ├── symbols.json
    ├── prices/
    │   ├── BTCUSDT.json
    │   ├── ETHUSDT.json
    │   └── ... (47 símbolos)
    └── funding/
        ├── BTCUSDT.json
        └── ...
```

**Formato de datos (Spot):**
```json
{
  "symbol": "BTCUSDT",
  "name": "Bitcoin",
  "data": [
    {
      "t": 1672531200000,  // timestamp
      "c": 16547.23        // close price
    }
  ]
}
```

**Formato de datos (Futures):**
```json
{
  "symbol": "BTCUSDT",
  "exportedAt": "2026-01-25T14:07:00.396Z",
  "count": 768000,
  "data": [
    {
      "t": 1596465000000,  // timestamp
      "i": "15m",          // interval
      "o": 11325.13,       // open
      "h": 11352,          // high
      "l": 11271.08,       // low
      "c": 11312.75,       // close
      "v": 6160.749,       // volume
      "qv": 69697412.82    // quote volume
    }
  ]
}
```

**Características:**
- ✅ **Rápido** - Sin API calls, datos locales
- ✅ **Spot + Futures** - Ambos disponibles
- ✅ **Múltiples intervalos** - 5m, 15m, 1h, 4h, 1d
- ✅ **Histórico profundo** - Hasta 2000 días
- ⚠️ **Datos estáticos** - Necesitan actualización manual

**Por qué esta fuente:**
- Scanner escanea ~2,450 pares (50×49)
- Haría ~5,000 llamadas a API → imposible por rate limits
- JSON local = análisis instantáneo
- Datos históricos consistentes para backtesting

---

### **3. BACKTEST (/backtest)**

#### Fuente de Datos: **JSON Local** 💾

**Hook utilizado:** `useBacktest`

**Consume:** Mismos archivos JSON que Scanner

**Características:**
- ✅ **Datos consistentes** - Mismo dataset que Scanner
- ✅ **Reproducible** - Mismo JSON = mismo resultado
- ✅ **Spot + Futures** - Ambas fuentes
- ✅ **Intervalos flexibles** - 5m a 1d

**Por qué esta fuente:**
- Backtesting requiere datos históricos extensos
- Necesita ser reproducible (mismo input = mismo output)
- No tiene sentido usar API en vivo para datos históricos

---

### **4. FUNDING (/funding)**

#### Fuente de Datos: **JSON Local** 💾

**Hook utilizado:** `useFundingRates`

**Ubicación:**
```
public/data/futures/funding/
├── BTCUSDT.json
├── ETHUSDT.json
└── ... (47 símbolos)
```

**Formato:**
```json
{
  "symbol": "BTCUSDT",
  "count": 2002,
  "data": [
    {
      "t": 1596499200003,   // funding time
      "rate": 0.00031113,   // funding rate
      "mark": 11500         // mark price
    }
  ]
}
```

**Características:**
- ✅ **Solo Futures** - Funding rates no existen en Spot
- ✅ **Histórico 2020-2025** - ~2000 registros por símbolo
- ✅ **3 períodos/día** - 00:00, 08:00, 16:00 UTC

---

## 🔄 Actualización de Datos

### **Datos Live (Compare):**

✅ **Automático** - CryptoCompare API siempre actualizada

### **Datos Locales (Scanner, Backtest, Funding):**

⚠️ **Manual** - Necesitas ejecutar scripts

#### **Actualizar Spot:**
```bash
npm run db:fetch          # Últimos 90 días
npm run db:fetch:year     # Último año
npm run db:export         # Exportar a JSON
```

**Fuente:** CryptoCompare API → DuckDB → JSON

#### **Actualizar Futures:**
```bash
npm run db:futures:all        # 15m, 2000 días
npm run db:futures:all-5m     # 5m, 2000 días
npm run db:futures:export     # Exportar a JSON
```

**Fuente:** Binance Futures API → DuckDB → JSON

#### **Frecuencia Recomendada:**
- **Spot:** Cada semana
- **Futures:** Cada 2 semanas
- **Funding:** Cada mes

---

## 📈 Pipeline de Datos

### **Spot (CryptoCompare):**

```
CryptoCompare API
    ↓
data/crypto.duckdb
    ↓
public/data/prices/*.json
    ↓
Scanner/Backtest
```

**Scripts:**
1. `data/scripts/fetch-cryptocompare.ts` - Fetch de API
2. `data/scripts/export-json.ts` - Export a JSON

### **Futures (Binance):**

```
Binance Futures API (FAPI)
    ↓
data/crypto-futures.duckdb
    ↓
public/data/futures/**/*.json
    ↓
Scanner/Backtest/Funding
```

**Scripts:**
1. `data/scripts/fetch-binance-futures.ts` - Fetch de API
2. `data/scripts/export-futures-json.ts` - Export a JSON

---

## 🎯 Ventajas de Este Approach

### **Híbrido (API + Local):**

**Compare usa API:**
- ✅ Análisis puntual de 1 par
- ✅ Datos siempre frescos
- ✅ Sin necesidad de setup

**Scanner/Backtest usan Local:**
- ✅ Escaneo masivo de 2,450 pares
- ✅ Sin rate limits
- ✅ Análisis instantáneo
- ✅ Reproducible

### **Alternativas consideradas:**

❌ **Todo API:**
- Scanner haría 5,000+ llamadas → rate limit
- Lento (200ms × 5000 = 16 minutos)
- Costoso si fuera API paga

❌ **Todo Local:**
- Compare necesitaría re-exportar para cada consulta
- Menos flexible para análisis exploratorio
- Datos nunca estarían "frescos"

✅ **Híbrido (actual):**
- Mejor de ambos mundos
- Compare rápido para exploración
- Scanner/Backtest potentes para análisis masivo

---

## 🔧 Troubleshooting

### **"Compare no carga datos"**

**Causa:** CryptoCompare API down o rate limit

**Solución:**
1. Verifica internet
2. Espera 1 minuto y reintenta
3. Verifica console del navegador para errores de API

### **"Scanner no encuentra pares"**

**Causa:** Archivos JSON no existen o están vacíos

**Solución:**
```bash
npm run db:fetch
npm run db:export
```

### **"Backtest muestra datos viejos"**

**Causa:** JSON no actualizado

**Solución:**
```bash
npm run db:fetch:year
npm run db:export
```

### **"Funding rates no cargan"**

**Causa:** Datos de Futures no exportados

**Solución:**
```bash
npm run db:futures:all
npm run db:futures:export
```

---

## 📊 Resumen de Símbolos

### **Spot (28 símbolos):**

```
BTC, ETH, BNB, SOL, ADA, DOGE, MATIC, DOT, AVAX, SHIB,
LTC, UNI, LINK, ATOM, XMR, XLM, ALGO, MANA, SAND, AXS,
FIL, AAVE, COMP, SNX, CRV, GRT, SUSHI, 1INCH
```

### **Futures (47 símbolos):**

```
BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT,
DOGEUSDT, AVAXUSDT, DOTUSDT, LINKUSDT, MATICUSDT,
LTCUSDT, UNIUSDT, ATOMUSDT, ETCUSDT, FILUSDT, APTUSDT,
ARBUSDT, OPUSDT, NEARUSDT, FTMUSDT, ALGOUSDT, XLMUSDT,
XMRUSDT, TRXUSDT, AAVEUSDT, MKRUSDT, SNXUSDT, COMPUSDT,
CRVUSDT, LDOUSDT, GMXUSDT, DYDXUSDT, INJUSDT, RUNEUSDT,
RENDERUSDT, GRTUSDT, FETUSDT, SANDUSDT, MANAUSDT,
AXSUSDT, GALAUSDT, IMXUSDT, SUIUSDT, SEIUSDT, TIAUSDT,
JUPUSDT, WLDUSDT, STXUSDT, ICPUSDT
```

---

## 🚀 Quick Reference

| Necesito... | Usa... | Datos... |
|-------------|--------|----------|
| Validar 1 par específico | Compare | CryptoCompare API |
| Encontrar mejores pares Spot | Scanner (Spot) | JSON Local |
| Encontrar mejores pares Futures | Scanner (Futures) | JSON Local |
| Backtest una estrategia | Backtest | JSON Local |
| Analizar funding rates | Funding | JSON Local |

**¿Datos desactualizados?**
```bash
npm run db:fetch && npm run db:export          # Spot
npm run db:futures:all && npm run db:futures:export  # Futures
```

---

**¿Preguntas?** Consulta [DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md) para más detalles técnicos.
