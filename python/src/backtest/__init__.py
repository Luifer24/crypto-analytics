"""
Backtest Engine

Professional statistical arbitrage backtesting engine using pandas and statsmodels.
"""

from .engine import run_backtest, BacktestConfig, BacktestResult
from .cointegration import engle_granger_test, calculate_z_score
from .metrics import calculate_metrics

__all__ = [
    "run_backtest",
    "BacktestConfig",
    "BacktestResult",
    "engle_granger_test",
    "calculate_z_score",
    "calculate_metrics",
]
