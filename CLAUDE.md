# crypto-analytics - Instrucciones para Claude

## Objetivo del Proyecto

Plataforma de **arbitraje estadístico para criptomonedas** que evoluciona desde un dashboard de visualización hacia una herramienta de trading cuantitativo.

## Contexto del Usuario

- **Background**: Profesional de fútbol + ingeniero de software
- **Rol con IA**: Arquitecto que diseña, Claude implementa
- **Conocimientos stat-arb**: Domina teoría (Engle-Granger, Johansen, Kalman, VAR/VECM)
- **Foco actual**: Construir infraestructura de tests estadísticos y backtesting

## Stack Técnico

- **Framework**: Next.js 16 con App Router
- **UI**: Tailwind CSS + shadcn/ui
- **Gráficos**: Recharts
- **Data fetching**: React Query
- **APIs**: CryptoCompare, Binance, CoinGecko

## Documentación Importante

| Documento | Contenido |
|-----------|-----------|
| [docs/STAT_ARB_ROADMAP.md](docs/STAT_ARB_ROADMAP.md) | Plan completo de implementación |
| [src/types/arbitrage.ts](src/types/arbitrage.ts) | Tipos TypeScript para stat-arb |
| [src/lib/statistics.ts](src/lib/statistics.ts) | Funciones estadísticas base |

## Arquitectura de Módulos

```
src/lib/
├── cointegration/     # Tests: ADF, Engle-Granger, Johansen
├── filters/           # Kalman filter, rolling OLS
├── backtest/          # Motor de simulación
└── statistics.ts      # Funciones base (existente)
```

## Prioridades de Implementación

1. **ADF Test** - Base para validar estacionariedad
2. **Engle-Granger** - Test de cointegración para pares
3. **Scanner** - Buscar pares cointegrados automáticamente
4. **Kalman** - Hedge ratio dinámico
5. **Backtest** - Validar estrategias con costes reales

## Reglas Específicas

1. **Precisión estadística**: Los tests deben dar resultados consistentes con Python/statsmodels
2. **Performance**: Cálculos pesados pueden ir en Web Workers
3. **No over-engineer**: Implementar lo necesario, validar, iterar
4. **Documentar fórmulas**: Comentarios con las ecuaciones matemáticas usadas

## Conceptos Clave (Quick Reference)

### Cointegración
Dos series I(1) están cointegradas si existe combinación lineal I(0):
```
Spread = Y - α - β·X  debe ser estacionario
```

### Señales de Trading
- Z-Score > +2 → Short spread
- Z-Score < -2 → Long spread
- Z-Score → 0 → Exit (mean reversion)

### Half-Life
Tiempo esperado para que el spread revierta 50% hacia su media.
Calculado via AR(1): `halfLife = -ln(2) / ln(φ)`

## Estado Actual

- ✅ Dashboard básico funcionando
- ✅ Página `/compare` con Z-Score y hedge ratio estático
- ✅ Tipos de arbitraje definidos
- ⏳ ADF Test (en progreso)
- ⏳ Scanner de pares
- ⏳ Kalman filter
- ⏳ Backtesting

---

*Ver [docs/STAT_ARB_ROADMAP.md](docs/STAT_ARB_ROADMAP.md) para el plan detallado*
