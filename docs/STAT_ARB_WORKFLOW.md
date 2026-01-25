# Statistical Arbitrage Workflow Guide
## De la A a la Z: Cómo usar crypto-analytics para Stat Arb

**Última actualización:** Enero 2026

---

## 🎯 Objetivo General

Encontrar pares de criptomonedas cointegrados que se mueven juntos a largo plazo, pero que temporalmente divergen, permitiendo aprovechar la reversión a la media para generar profit.

---

## 📊 El Workflow Completo (A → Z)

### **Nivel 1: Exploración Manual (COMPARE)**
**Ruta:** `/compare`
**Propósito:** Validar hipótesis de pares específicos
**Cuándo usar:** Cuando tienes una idea de qué pares podrían estar cointegrados

#### Proceso:
1. **Selecciona 2 símbolos** (ej: ETHUSDT vs BTCUSDT)
2. **Elige intervalo temporal** (1h, 4h, 1d)
3. **Analiza los resultados:**
   - ✅ **Engle-Granger p-value < 0.05** → Cointegrados
   - ✅ **Johansen trace stat > critical value** → Confirmación adicional
   - 📊 **Gráfico de spread** → Visualiza la reversión a la media
   - 📈 **Half-life** → Cuánto tarda el spread en revertir (ideal: 5-30 períodos)

#### Ejemplo práctico:
```
ETH/BTC → Engle-Granger p=0.001 ✅
Half-life: 12 períodos (4h) → ~2 días
Hedge ratio: 0.065 (comprar 1 ETH, vender 0.065 BTC)
```

**⚠️ Limitación:** Solo puedes probar pares manualmente uno por uno.

---

### **Nivel 2: Descubrimiento Masivo (SCANNER)**
**Ruta:** `/scanner`
**Propósito:** Encontrar TODOS los pares cointegrados automáticamente
**Cuándo usar:** Cuando quieres explorar oportunidades sin sesgo previo

#### Proceso:
1. **Configura el scanner:**
   - Data source: Spot o Futures
   - Interval: 5m, 15m, 1h, 4h, 1d
   - Lookback: 30, 60, 90 días
   - Min cointegration score: 3-5
   - Max half-life: 30 períodos

2. **Ejecuta el scan** (escanea 50 símbolos × 49 = ~2,450 pares)

3. **Revisa resultados ordenados por:**
   - **Cointegration Score** (0-5): Calidad estadística
   - **Z-Score actual**: Qué tan divergido está el spread AHORA
   - **Half-life**: Velocidad de reversión
   - **Spread volatility**: Estabilidad del spread

4. **Filtra por señales:**
   - 🟢 **LONG** (Z < -2): El spread está muy bajo → comprar spread
   - 🔴 **SHORT** (Z > +2): El spread está muy alto → vender spread
   - ⚪ **NEUTRAL** (|Z| < 2): Sin señal clara

#### Ejemplo de resultado:
```
Pair: SOLUSDT/AVAXUSDT
Score: 4.2 ⭐⭐⭐⭐
Z-Score: -2.8 → LONG signal 🟢
Half-life: 8 períodos (1h) → ~8 horas
Entry: Ahora (spread bajo)
```

**Funding Rates (solo Futures):**
- Si estás en Futures, también verás funding rates
- Útil para Cash & Carry arbitrage (tema aparte)

---

### **Nivel 3: Hedge Dinámico (KALMAN FILTER)**
**Integrado en:** Scanner y Backtesting
**Propósito:** Mejorar el hedge ratio que cambia en el tiempo
**Cuándo usar:** Para estrategias más sofisticadas

#### Conceptos:
- **OLS (Static):** Hedge ratio fijo calculado por regresión lineal
  - Pros: Simple, estable
  - Contras: No se adapta a cambios de correlación

- **Kalman Filter (Dynamic):** Hedge ratio que evoluciona
  - Pros: Se adapta a cambios de mercado
  - Contras: Más complejo, puede sobre-ajustar

#### En el Scanner:
El scanner calcula **ambos** hedge ratios:
- `hedgeRatio`: OLS (estático)
- En backtesting, puedes elegir entre static/dynamic

#### Cuándo usar Dynamic:
- Mercados volátiles donde la correlación cambia
- Pares con fundamentals que evolucionan (ej: ETH vs L2s)
- Cuando backtest con dynamic > backtest con static

---

### **Nivel 4: Validación Histórica (BACKTEST)**
**Ruta:** `/backtest`
**Propósito:** Validar si una estrategia de par hubiera sido rentable
**Cuándo usar:** ANTES de operar con dinero real

#### Proceso:
1. **Selecciona el par** (desde Scanner o manual)
2. **Configura parámetros:**
   - Data source: Spot/Futures
   - Interval: 5m, 15m, 1h, 4h, 1d
   - Lookback: Cuántos días de datos usar
   - Hedge type: Static (OLS) vs Dynamic (Kalman)

3. **Define reglas de trading:**
   - Entry threshold: Z-score para entrar (default: ±2)
   - Exit threshold: Z-score para salir (default: 0)
   - Stop loss: Máximo Z-score soportable (default: ±3)

4. **Analiza resultados:**
   - **Sharpe Ratio** > 1.5 → Bueno
   - **Sortino Ratio** > 2.0 → Excelente
   - **Max Drawdown** < 20% → Aceptable
   - **Win Rate** > 55% → Saludable
   - **Equity Curve** → Debe ser ascendente consistentemente

5. **Revisa trades individuales:**
   - Entry/Exit dates
   - PnL por trade
   - Duration
   - Identifica patterns de pérdidas

#### Ejemplo de backtest:
```
Pair: ETHUSDT/BTCUSDT
Period: 90 días (1h data)
Hedge: Dynamic (Kalman)

Results:
Sharpe: 2.1 ✅
Max DD: -12% ✅
Win Rate: 62% ✅
Total Return: +18.5%
Trades: 24 (15W, 9L)

→ ESTRATEGIA VIABLE
```

**⚠️ Importante:**
- Transaction costs incluidos (0.08% total)
- Slippage modelado (3 bps)
- No confíes en backtests con <20 trades
- Out-of-sample testing recomendado

---

## 🔄 El Ciclo Completo en la Práctica

### **Workflow Recomendado:**

#### **Paso 1: Discovery (SCANNER)**
```
1. Ejecuta scanner con lookback=60d, interval=1h
2. Filtra por score >= 4.0
3. Exporta top 10 pares con mejor score
```

#### **Paso 2: Deep Dive (COMPARE)**
```
Para cada par del top 10:
1. Verifica cointegración en múltiples timeframes
2. Analiza gráfico de spread visualmente
3. Confirma half-life razonable (5-30 períodos)
4. Descarta pares con spread no estacionario
```

#### **Paso 3: Validation (BACKTEST)**
```
Para pares que pasaron Step 2:
1. Backtest 90 días con OLS
2. Backtest 90 días con Kalman
3. Compara métricas (Sharpe, DD, Win Rate)
4. Selecciona configuración óptima
5. Valida en out-of-sample (últimos 30 días)
```

#### **Paso 4: Live Monitoring (SCANNER)**
```
1. Configura scanner con tus pares validados
2. Monitorea Z-scores en tiempo real
3. Espera señales de entrada (Z > +2 o Z < -2)
4. Ejecuta trades según reglas de backtest
```

#### **Paso 5: Post-Trade Analysis (COMPARE + BACKTEST)**
```
1. Registra trades ejecutados
2. Compara vs backtest esperado
3. Ajusta parámetros si necesario
4. Re-backtest cada mes con datos nuevos
```

---

## 📈 Niveles de Complejidad

### **Beginner: Exploración básica**
- Usa **COMPARE** para entender cointegración
- Prueba pares obvios (ETH/BTC, SOL/AVAX)
- Aprende a interpretar p-values y half-life
- **Tiempo:** 1-2 horas

### **Intermediate: Descubrimiento sistemático**
- Usa **SCANNER** para encontrar oportunidades
- Valida pares con **COMPARE**
- Entiende la diferencia entre Spot y Futures
- Monitorea Z-scores para timing
- **Tiempo:** 1 día

### **Advanced: Trading algorítmico**
- Domina **BACKTEST** para optimización
- Compara Static vs Dynamic hedge ratios
- Optimiza entry/exit thresholds
- Implementa position sizing
- **Tiempo:** 1 semana+

### **Expert: Producción**
- Automatiza scanner alerts
- Integra con APIs de exchanges
- Implementa gestión de riesgo
- Monitor continuo de performance
- **Tiempo:** Continuo

---

## 🎓 Conceptos Clave por Sección

### **COMPARE** te enseña:
- ✅ Qué es cointegración
- ✅ Cómo leer tests estadísticos
- ✅ Visualizar spreads y reversión
- ✅ Calcular hedge ratios

### **SCANNER** te da:
- ✅ Universo completo de oportunidades
- ✅ Señales de entrada/salida (Z-score)
- ✅ Comparación lado-a-lado de pares
- ✅ Filtrado por calidad estadística

### **BACKTEST** te valida:
- ✅ Rentabilidad histórica
- ✅ Risk-adjusted returns (Sharpe)
- ✅ Comportamiento en drawdowns
- ✅ Efectividad de parámetros

---

## 🚫 Errores Comunes a Evitar

### **En COMPARE:**
- ❌ Confundir correlación con cointegración
- ❌ Ignorar el half-life (muy largo = malo)
- ❌ No verificar en múltiples timeframes

### **En SCANNER:**
- ❌ Operar todos los pares con señal (solo los mejor score)
- ❌ Ignorar funding rates en Futures
- ❌ No filtrar por half-life razonable

### **En BACKTEST:**
- ❌ Over-optimizar parámetros (overfitting)
- ❌ No incluir transaction costs
- ❌ Backtest con muy pocos datos (<60 días)
- ❌ Confiar en <15 trades totales

---

## 💡 Tips Pro

1. **Usa múltiples timeframes:**
   - Scan en 1h para señales diarias
   - Scan en 15m para señales intraday
   - Valida en 4h para trends de semana

2. **Combina métricas:**
   - Score alto + Z-score extremo + Half-life corto = Mejor setup

3. **Paper trade primero:**
   - Usa Scanner para señales
   - Registra trades "virtuales"
   - Compara vs Backtest predicho
   - Solo pasa a live después de 1 mes exitoso

4. **Re-calibra regularmente:**
   - Re-escanea cada semana
   - Pares que eran cointegrados pueden dejar de serlo
   - Nuevos pares pueden emerger

5. **Diversifica pares:**
   - No operes un solo par
   - Portfolio de 5-10 pares reduce riesgo
   - Diferentes sectores (DeFi, L1s, L2s)

---

## 📚 Recursos Adicionales

- **Cointegration Theory:** [docs/DATA_ARCHITECTURE.md](DATA_ARCHITECTURE.md)
- **API Standards:** [docs/API_STANDARDS.md](API_STANDARDS.md)
- **Tech Stack:** [docs/STACK.md](STACK.md)

---

## 🎯 Checklist de Éxito

Antes de operar con dinero real, asegúrate de:

- [ ] Entiendes qué es cointegración (no solo correlación)
- [ ] Puedes interpretar p-values de Engle-Granger
- [ ] Sabes qué es un "good" half-life para tu timeframe
- [ ] Has backtestado al menos 5 pares diferentes
- [ ] Tus backtests muestran Sharpe > 1.5
- [ ] Entiendes la diferencia entre Static y Dynamic hedge
- [ ] Has hecho paper trading por al menos 2 semanas
- [ ] Tienes un plan de gestión de riesgo (max DD, position size)

---

**¿Listo para empezar?**

👉 **Principiante:** Empieza en `/compare` con ETH/BTC
👉 **Intermedio:** Escanea en `/scanner` con lookback=60d
👉 **Avanzado:** Backtest tus mejores pares en `/backtest`

**Happy Trading! 📈**
