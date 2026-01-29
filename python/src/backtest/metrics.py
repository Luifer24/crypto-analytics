"""
Metrics Module

Calculate backtest performance metrics: Sharpe, Sortino, Calmar, etc.
"""

import numpy as np
import pandas as pd
from typing import List, Dict
from dataclasses import dataclass


@dataclass
class BacktestMetrics:
    """Backtest performance metrics"""

    total_return: float  # Total return as percentage
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float  # Percentage
    profit_factor: float
    avg_win: float  # Average winning trade PnL
    avg_loss: float  # Average losing trade PnL (negative)
    max_win: float
    max_loss: float
    avg_holding_period: float  # In bars
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown: float  # As percentage
    max_drawdown_duration: int  # In bars


def calculate_metrics(
    trades: List[Dict],
    daily_returns: np.ndarray,
    interval: str = "1d",
) -> BacktestMetrics:
    """
    Calculate comprehensive backtest metrics

    Args:
        trades: List of trade dictionaries with pnl_net, holding_period, etc.
        daily_returns: Array of returns per bar
        interval: Bar interval for annualization ('5min', '15min', '1h', '1d', etc.)

    Returns:
        BacktestMetrics object with all performance statistics
    """
    # Trade statistics
    total_trades = len(trades)

    if total_trades == 0:
        return _empty_metrics()

    # Extract PnLs
    pnls = np.array([t["pnl_net"] for t in trades])
    winning_pnls = pnls[pnls > 0]
    losing_pnls = pnls[pnls < 0]

    winning_trades = len(winning_pnls)
    losing_trades = len(losing_pnls)
    win_rate = winning_trades / total_trades if total_trades > 0 else 0.0

    # Average wins/losses
    avg_win = np.mean(winning_pnls) if len(winning_pnls) > 0 else 0.0
    avg_loss = np.mean(losing_pnls) if len(losing_pnls) > 0 else 0.0

    # Max win/loss
    max_win = np.max(winning_pnls) if len(winning_pnls) > 0 else 0.0
    max_loss = np.min(losing_pnls) if len(losing_pnls) > 0 else 0.0

    # Profit factor
    gross_profit = np.sum(winning_pnls) if len(winning_pnls) > 0 else 0.0
    gross_loss = abs(np.sum(losing_pnls)) if len(losing_pnls) > 0 else 0.0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    # Holding period
    holding_periods = [t["holding_period"] for t in trades]
    avg_holding_period = np.mean(holding_periods) if holding_periods else 0.0

    # Total return
    total_return = np.prod(1 + daily_returns) - 1

    # Risk metrics
    sharpe = calculate_sharpe_ratio(daily_returns, interval)
    sortino = calculate_sortino_ratio(daily_returns, interval)
    max_dd, max_dd_duration = calculate_max_drawdown(daily_returns)
    calmar = calculate_calmar_ratio(daily_returns, max_dd, interval)

    return BacktestMetrics(
        total_return=total_return,
        total_trades=total_trades,
        winning_trades=winning_trades,
        losing_trades=losing_trades,
        win_rate=win_rate,
        profit_factor=profit_factor,
        avg_win=avg_win,
        avg_loss=avg_loss,
        max_win=max_win,
        max_loss=max_loss,
        avg_holding_period=avg_holding_period,
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        calmar_ratio=calmar,
        max_drawdown=max_dd,
        max_drawdown_duration=max_dd_duration,
    )


def calculate_sharpe_ratio(returns: np.ndarray, interval: str = "1d") -> float:
    """
    Calculate annualized Sharpe ratio

    Sharpe = (Mean Return * Annualization Factor) / (Std Dev * sqrt(Annualization Factor))

    Args:
        returns: Array of returns per bar
        interval: Bar interval for annualization

    Returns:
        Annualized Sharpe ratio
    """
    if len(returns) < 2:
        return 0.0

    mean_return = np.mean(returns)
    std_return = np.std(returns, ddof=1)

    if std_return == 0:
        return 0.0

    # Get annualization factor
    ann_factor = get_annualization_factor(interval)

    # Annualized Sharpe
    sharpe = (mean_return * ann_factor) / (std_return * np.sqrt(ann_factor))

    return sharpe


def calculate_sortino_ratio(
    returns: np.ndarray,
    interval: str = "1d",
    target_return: float = 0.0,
) -> float:
    """
    Calculate annualized Sortino ratio

    Like Sharpe but only penalizes downside volatility.

    Args:
        returns: Array of returns per bar
        interval: Bar interval for annualization
        target_return: Target return (default 0)

    Returns:
        Annualized Sortino ratio
    """
    if len(returns) < 2:
        return 0.0

    mean_return = np.mean(returns)

    # Downside deviation (only negative returns)
    downside_returns = returns[returns < target_return]

    if len(downside_returns) == 0:
        return float("inf") if mean_return > 0 else 0.0

    downside_std = np.std(downside_returns, ddof=1)

    if downside_std == 0:
        return 0.0

    # Get annualization factor
    ann_factor = get_annualization_factor(interval)

    # Annualized Sortino
    sortino = (mean_return * ann_factor) / (downside_std * np.sqrt(ann_factor))

    return sortino


def calculate_max_drawdown(returns: np.ndarray) -> tuple[float, int]:
    """
    Calculate maximum drawdown and its duration

    Args:
        returns: Array of returns per bar

    Returns:
        Tuple of (max_drawdown_pct, max_drawdown_duration_bars)
    """
    if len(returns) == 0:
        return 0.0, 0

    # Build equity curve
    equity = np.cumprod(1 + returns)

    # Calculate running maximum
    running_max = np.maximum.accumulate(equity)

    # Calculate drawdown at each point
    drawdown = (equity - running_max) / running_max

    # Maximum drawdown
    max_dd = abs(np.min(drawdown))

    # Calculate drawdown duration
    max_dd_duration = 0
    current_dd_duration = 0

    for dd in drawdown:
        if dd < 0:
            current_dd_duration += 1
            max_dd_duration = max(max_dd_duration, current_dd_duration)
        else:
            current_dd_duration = 0

    return max_dd, max_dd_duration


def calculate_calmar_ratio(
    returns: np.ndarray,
    max_drawdown: float,
    interval: str = "1d",
) -> float:
    """
    Calculate Calmar ratio

    Calmar = Annualized Return / Max Drawdown

    Measures return per unit of downside risk.

    Args:
        returns: Array of returns per bar
        max_drawdown: Maximum drawdown as percentage
        interval: Bar interval for annualization

    Returns:
        Calmar ratio
    """
    if max_drawdown == 0:
        return 0.0

    # Calculate annualized return
    total_return = np.prod(1 + returns) - 1
    ann_factor = get_annualization_factor(interval)
    periods = len(returns)

    if periods == 0:
        return 0.0

    # Annualize the return
    annualized_return = (1 + total_return) ** (ann_factor / periods) - 1

    # Calmar ratio
    calmar = annualized_return / max_drawdown

    return calmar


def get_annualization_factor(interval: str) -> float:
    """
    Get annualization factor for a given interval

    Args:
        interval: Bar interval ('5min', '15min', '1h', '4h', '1d', etc.)

    Returns:
        Number of periods per year

    Examples:
        '5min' → 105120 (365 * 24 * 60 / 5)
        '15min' → 35040 (365 * 24 * 60 / 15)
        '1h' → 8760 (365 * 24)
        '1d' → 365
    """
    interval = interval.lower().strip()

    # Minute intervals
    if interval.endswith('min') or interval.endswith('m'):
        minutes = float(interval.rstrip('minm'))
        return 365 * 24 * 60 / minutes

    # Hour intervals
    if interval.endswith('h'):
        hours = float(interval.rstrip('h'))
        return 365 * 24 / hours

    # Day intervals
    if interval.endswith('d'):
        days = float(interval.rstrip('d'))
        return 365 / days

    # Week intervals
    if interval.endswith('w'):
        weeks = float(interval.rstrip('w'))
        return 52 / weeks

    # Default to daily
    return 365


def _empty_metrics() -> BacktestMetrics:
    """Return empty metrics when no trades"""
    return BacktestMetrics(
        total_return=0.0,
        total_trades=0,
        winning_trades=0,
        losing_trades=0,
        win_rate=0.0,
        profit_factor=0.0,
        avg_win=0.0,
        avg_loss=0.0,
        max_win=0.0,
        max_loss=0.0,
        avg_holding_period=0.0,
        sharpe_ratio=0.0,
        sortino_ratio=0.0,
        calmar_ratio=0.0,
        max_drawdown=0.0,
        max_drawdown_duration=0,
    )
