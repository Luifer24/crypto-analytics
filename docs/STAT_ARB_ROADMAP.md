# Roadmap: Plataforma de Arbitraje Estadístico

## Visión General

Evolucionar crypto-analytics de un dashboard de visualización a una **plataforma completa de arbitraje estadístico** para criptomonedas.

## Contexto del Usuario

- **Profesión**: Profesional en fútbol (Al Ain FC, UAE)
- **Objetivo técnico**: Ser software architect usando IA para implementar
- **Conocimientos**: Ha estudiado a fondo los conceptos teóricos de stat-arb:
  - Cointegración (Engle-Granger, Johansen)
  - Spread construction y hedge ratios
  - Mean reversion y half-life
  - Filtro de Kalman para parámetros dinámicos
  - VAR/VECM
  - Microestructura de mercado, slippage, ejecución

---

## Estado Actual (Enero 2025)

### Lo que existe:
- `src/lib/statistics.ts` - Estadística básica, cointegración heurística, ACF/PACF
- `src/app/compare/page.tsx` - Pairs trading con Z-Score y hedge ratio estático
- APIs integradas: CryptoCompare, Binance, CoinGecko
- Visualizaciones con Recharts

### Lo que falta:
1. Tests de estacionariedad (ADF) formales con p-values
2. Test de Johansen para cestas multi-activo
3. Kalman filter para hedge ratio dinámico
4. Scanner automático de pares cointegrados
5. Motor de backtesting con costes y slippage
6. Dashboard operativo para trading real

---

## Arquitectura Objetivo

```
src/
├── lib/
│   ├── statistics.ts          # Existente
│   ├── cointegration/         # Tests formales
│   │   ├── adf.ts            # Augmented Dickey-Fuller
│   │   ├── engle-granger.ts  # Test EG completo
│   │   ├── johansen.ts       # Test Johansen
│   │   └── half-life.ts      # Ornstein-Uhlenbeck
│   ├── filters/               # Modelos dinámicos
│   │   ├── kalman.ts         # Kalman filter para β_t
│   │   └── rolling-ols.ts    # OLS rolling baseline
│   └── backtest/              # Backtesting
│       ├── engine.ts         # Motor de simulación
│       ├── metrics.ts        # Sharpe, Sortino, drawdown
│       └── execution.ts      # Modelo de costes
├── hooks/
│   ├── usePairScanner.ts     # Scanner de pares
│   ├── useCointegration.ts   # Wrapper de tests
│   ├── useKalmanHedge.ts     # Hedge ratio dinámico
│   └── useBacktest.ts        # Ejecutar backtests
├── app/
│   ├── compare/              # Mejorar existente
│   ├── scanner/              # Multi-pair screening
│   ├── backtest/             # Backtesting UI
│   └── arbitrage/            # Dashboard operativo
└── types/
    └── arbitrage.ts          # Tipos stat-arb ✅ CREADO
```

---

## Fases de Implementación

### Fase 1: Tests Estadísticos Formales ✅ COMPLETADA
- [x] Crear tipos (`src/types/arbitrage.ts`)
- [x] ADF Test con p-values reales (`src/lib/cointegration/adf.ts`)
- [x] Engle-Granger completo (`src/lib/cointegration/engle-granger.ts`)
- [x] Half-life via AR(1)/OU (`src/lib/cointegration/half-life.ts`)

### Fase 2: Scanner de Pares ✅ COMPLETADA
- [x] Hook `usePairScanner` (`src/hooks/usePairScanner.ts`)
- [x] UI `/scanner` con tabla de resultados (`src/app/scanner/page.tsx`)
- [x] Filtros: correlación, p-value, half-life, señales
- [x] Link en navegación lateral

### Fase 3: Kalman Filter ✅ COMPLETADA
- [x] Clase `KalmanFilter` (`src/lib/filters/kalman.ts`)
- [x] Hook `useKalmanHedge` (`src/hooks/useKalmanHedge.ts`)
- [x] Comparación β estático vs dinámico en /compare
- [x] Gráfico de evolución del hedge ratio dinámico

### Fase 4: Backtesting
- [ ] Motor `runBacktest()`
- [ ] Modelo de slippage y comisiones
- [ ] UI con equity curve y métricas

### Fase 5: Dashboard Operativo
- [ ] Monitoreo de posiciones
- [ ] Alertas de Z-Score
- [ ] PnL en tiempo real

---

## Conceptos Clave (Referencia Rápida)

### Escalera de Complejidad
```
Engle-Granger → Johansen → Kalman
(estático)      (multi)     (dinámico)
```

### Objetivo del Spread
Crear una serie temporal que sea:
1. **Estacionaria** - media/varianza estables
2. **Mean-reverting** - tiende a volver a su media

### Fórmula del Spread
```
S_t = Y_t - α - β·X_t

donde:
- β = hedge ratio
- α = intercepto
- S_t debe ser I(0) si hay cointegración
```

### Señales de Trading
- Z-Score > +2: Short spread (short A, long β·B)
- Z-Score < -2: Long spread (long A, short β·B)
- Z-Score → 0: Exit (mean reversion)

---

## Verificación

### Tests Estadísticos
- ADF debe dar p-values consistentes con Python statsmodels
- Half-life debe coincidir con valores teóricos
- Scanner debe identificar pares conocidos (BTC/ETH)

### Backtesting
- PnL correcto incluyendo costes
- Métricas calculadas correctamente
- Resultados reproducibles

---

## Referencias del Usuario

El usuario ha estudiado estos conceptos a través de conversaciones con Perplexity:
- Cointegración y Engle-Granger
- Johansen para cestas multi-activo
- Kalman filter para hedge ratios dinámicos
- Microestructura: order book, slippage, ejecución
- Diferencia entre correlación y cointegración

---

*Última actualización: Enero 2025*
