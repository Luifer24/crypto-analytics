# Quickstart Guide - Python Backend

## 🎯 Lo Que Acabamos de Crear

Has creado un **proyecto híbrido profesional** exactamente como lo usan los quant shops:

```
Next.js (UI) ←→ Python (Compute Engine) ←→ Data Storage
```

- **Next.js**: Mantén tu Backtest actual funcionando
- **Python**: Nuevo motor profesional para Backtest 2.0
- **Ambos comparten**: Mismos datos en `/public/data`

---

## 📁 Estructura Creada

```
crypto-analytics/
├── src/                    # Next.js (existente)
│   └── app/
│       ├── backtest/      # Backtest actual (TypeScript)
│       └── backtest-v2/   # Backtest 2.0 (llamará Python) ← NUEVO
├── python/                 # Motor Python ← NUEVO
│   ├── pyproject.toml     # Dependencias (Poetry)
│   ├── Dockerfile         # Para Docker
│   ├── Makefile           # Comandos útiles
│   └── src/
│       ├── api/           # FastAPI (endpoints)
│       ├── backtest/      # Motor de backtest
│       ├── strategy/      # Cointegración, Kalman, etc.
│       └── data/          # Carga de datos
└── docker-compose.yml      # Correr todo junto
```

---

## 🚀 Cómo Empezar (3 Opciones)

### Opción 1: Local con Poetry (Recomendada para desarrollo)

```bash
# 1. Instalar Poetry (solo primera vez)
curl -sSL https://install.python-poetry.org | python3 -

# 2. Ir a carpeta python
cd python

# 3. Instalar dependencias
poetry install

# 4. Correr servidor
poetry run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

# ✅ API corriendo en: http://localhost:8000
# 📖 Docs automáticas: http://localhost:8000/docs
```

### Opción 2: Docker Compose (Todo junto)

```bash
# Desde la raíz del proyecto
docker-compose up

# ✅ Next.js: http://localhost:3000
# ✅ Python API: http://localhost:8000
```

### Opción 3: Make (Atajos útiles)

```bash
cd python

# Instalar deps
make install

# Correr
make run

# Tests
make test

# Format
make format
```

---

## 🔍 Verifica que Funciona

### 1. Health Check

```bash
curl http://localhost:8000/health
```

Deberías ver:
```json
{
  "status": "healthy",
  "components": {
    "api": "operational",
    "backtest_engine": "operational"
  }
}
```

### 2. Ver Documentación Automática

Abre: `http://localhost:8000/docs`

Verás todos los endpoints con ejemplos interactivos (gracias a FastAPI).

---

## 🎨 Cómo Funciona el Híbrido

### 1. Usuario en Next.js

```
Usuario configura backtest → Página "Backtest 2.0"
```

### 2. Next.js llama Python

```typescript
// src/app/backtest-v2/page.tsx
const response = await fetch('http://localhost:8000/api/v1/backtest/run', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symbol1: 'FIL',
    symbol2: 'ICP',
    prices1: [/* array de precios */],
    prices2: [/* array de precios */],
    interval: '15min',
    lookback_days: 90,
    config: {
      entry_threshold: 2.0,
      exit_threshold: 0.0,
      stop_loss: 3.0
    }
  })
});

const result = await response.json();
// result tiene: trades, metrics, equity_curve
```

### 3. Python procesa

```python
# python/src/api/routes/backtest.py
@router.post("/run")
async def run_backtest_endpoint(request: BacktestRequest):
    # Aquí correrá el motor con pandas/vectorbt
    result = run_backtest(
        prices1=request.prices1,
        prices2=request.prices2,
        config=request.config
    )
    return result
```

### 4. Next.js muestra resultados

```typescript
// Visualiza con Recharts (ya lo tienes)
<LineChart data={result.equity_curve}>
  ...
</LineChart>
```

---

## 📊 Ventajas de Esta Arquitectura

| Aspecto | Antes (TS puro) | Ahora (Híbrido) |
|---------|-----------------|-----------------|
| **UI** | ✅ Excelente | ✅ Misma calidad |
| **Backtest velocidad** | ⚠️ Lento para muchos | ✅ 10-100x más rápido |
| **Librerías quant** | ❌ Limitadas | ✅ statsmodels, vectorbt |
| **Escalabilidad** | ❌ Un solo thread | ✅ Parallel processing |
| **Mantenimiento** | ⚠️ Reinventar ruedas | ✅ Usar librerías probadas |
| **Ejecución real** | ❌ Reescribir todo | ✅ Ya está en Python |

---

## 🎯 Próximos Pasos

1. ✅ **Ya hecho**: Estructura Python + FastAPI funcionando
2. **Siguiente**: Crear página "Backtest 2.0" en Next.js
3. **Luego**: Implementar motor Python real (quitar mock)
4. **Finalmente**: Validar que da mismos resultados que TS

---

## 💡 Preguntas Comunes

### ¿Borro el backtest TypeScript?
**NO.** Mantén `/app/backtest` funcionando:
- Como referencia
- Para validar que Python da mismos resultados
- Para comparar performance

### ¿Cómo aprendo FastAPI?
La doc en `http://localhost:8000/docs` es interactiva. Puedes probar todos los endpoints ahí.

### ¿Y si quiero cambiar algo en Python?
```bash
cd python
# Edita archivos en src/
# Servidor se reinicia automáticamente (--reload)
```

### ¿Cómo debugeo?
```python
# En cualquier archivo Python
import pdb; pdb.set_trace()  # Breakpoint

# O usa logs
from loguru import logger
logger.info("Debug info here")
```

---

## 🆘 Si Algo Falla

### Error: "poetry: command not found"
```bash
curl -sSL https://install.python-poetry.org | python3 -
# Luego reinicia terminal
```

### Error: "Port 8000 already in use"
```bash
# Mata proceso
lsof -ti:8000 | xargs kill -9

# O usa otro puerto
poetry run uvicorn src.api.main:app --reload --port 8001
```

### Error al instalar dependencias
```bash
# Limpia cache
poetry cache clear pypi --all
poetry install
```

---

## 📚 Recursos

- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Poetry Docs](https://python-poetry.org/docs/)
- [vectorbt Docs](https://vectorbt.dev/)
- [statsmodels Docs](https://www.statsmodels.org/)

---

**Listo para crear "Backtest 2.0" página en Next.js? 🚀**
