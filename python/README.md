# Crypto Analytics - Python Engine

Statistical arbitrage backtest engine built with Python for performance and professional quant libraries.

## Stack

- **FastAPI**: Modern Python web framework
- **NumPy/Pandas**: Numerical computing
- **statsmodels**: Cointegration tests (ADF, Johansen)
- **pykalman**: Kalman filter for dynamic hedge ratio
- **vectorbt**: Vectorized backtesting
- **Numba**: JIT compilation for performance

## Setup

### 1. Install Poetry (if not installed)

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

### 2. Install dependencies

```bash
cd python
poetry install
```

### 3. Setup environment

```bash
cp .env.example .env
# Edit .env if needed
```

### 4. Run development server

```bash
poetry run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

## Project Structure

```
python/
├── src/
│   ├── __init__.py
│   ├── api/                  # FastAPI endpoints
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── backtest.py   # Backtest endpoints
│   ├── backtest/             # Backtest engine
│   │   ├── __init__.py
│   │   ├── engine.py         # Main backtest logic
│   │   ├── metrics.py        # Performance metrics
│   │   └── execution.py      # Costs, slippage
│   ├── strategy/             # Trading strategies
│   │   ├── __init__.py
│   │   ├── cointegration.py  # EG, Johansen tests
│   │   ├── kalman.py         # Kalman filter
│   │   └── signals.py        # Z-Score, signals
│   ├── data/                 # Data loading
│   │   ├── __init__.py
│   │   └── loader.py
│   └── utils/
│       ├── __init__.py
│       └── logger.py
└── tests/
    ├── __init__.py
    ├── test_backtest.py
    └── test_cointegration.py
```

## Usage

### Basic backtest API call

```python
import requests

response = requests.post("http://localhost:8000/api/v1/backtest/run", json={
    "symbol1": "FIL",
    "symbol2": "ICP",
    "prices1": [...],
    "prices2": [...],
    "lookback_days": 90,
    "interval": "15min",
    "config": {
        "entry_threshold": 2.0,
        "exit_threshold": 0.0,
        "stop_loss": 3.0
    }
})

result = response.json()
print(f"Total Return: {result['metrics']['total_return']:.2%}")
print(f"Sharpe Ratio: {result['metrics']['sharpe']:.2f}")
```

## Development

### Run tests

```bash
poetry run pytest
```

### Format code

```bash
poetry run black src tests
poetry run ruff src tests --fix
```

### Type checking

```bash
poetry run mypy src
```

## Notes

- This engine is designed for research and backtesting ONLY
- For live trading, additional safety checks and risk management required
- Always validate results against TypeScript implementation initially
