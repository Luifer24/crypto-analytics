"""
Cointegration Module

Implements Engle-Granger two-step cointegration test using statsmodels.
"""

import numpy as np
import pandas as pd
from statsmodels.regression.linear_model import OLS
from statsmodels.tsa.stattools import adfuller
from typing import Dict, Tuple, Optional
from dataclasses import dataclass


# MacKinnon (1991) critical values for cointegration test
# More conservative than standard ADF critical values
COINTEGRATION_CRITICAL_VALUES = {
    2: {  # 2 variables (pair)
        "1%": -3.90,
        "5%": -3.34,
        "10%": -3.04,
    },
    3: {  # 3 variables
        "1%": -4.29,
        "5%": -3.74,
        "10%": -3.45,
    },
}


@dataclass
class EngleGrangerResult:
    """Result from Engle-Granger cointegration test"""

    statistic: float  # ADF statistic on residuals
    p_value: float
    is_cointegrated: bool
    hedge_ratio: float  # β from cointegrating regression
    intercept: float  # α from cointegrating regression
    residuals: np.ndarray
    r_squared: float
    critical_values: Dict[str, float]


def engle_granger_test(
    prices_y: np.ndarray,
    prices_x: np.ndarray,
    maxlag: Optional[int] = None,
) -> EngleGrangerResult:
    """
    Engle-Granger Two-Step Cointegration Test

    Step 1: Estimate the cointegrating regression Y = α + βX + u
    Step 2: Test residuals for stationarity using ADF

    Args:
        prices_y: Dependent variable (Y) price series
        prices_x: Independent variable (X) price series
        maxlag: Maximum lag for ADF test (None = auto)

    Returns:
        EngleGrangerResult with test statistics and cointegration parameters

    Reference:
        Engle & Granger (1987), MacKinnon (1991)
    """
    # Validate input
    if len(prices_y) != len(prices_x):
        raise ValueError("Price series must have same length")

    if len(prices_y) < 20:
        raise ValueError("Need at least 20 observations")

    # Step 1: Cointegrating regression using OLS
    # Y = α + βX + u
    X = np.column_stack([np.ones(len(prices_x)), prices_x])
    model = OLS(prices_y, X)
    results = model.fit()

    intercept = results.params[0]
    hedge_ratio = results.params[1]
    residuals = results.resid
    r_squared = results.rsquared

    # Step 2: ADF test on residuals
    # Use "n" (no constant) because residuals have mean ~0 by construction
    adf_result = adfuller(
        residuals,
        maxlag=maxlag,
        regression="n",  # No constant for residual test
        autolag="AIC",
    )

    adf_statistic = adf_result[0]
    adf_p_value = adf_result[1]

    # Use cointegration-specific critical values
    critical_values = COINTEGRATION_CRITICAL_VALUES[2]

    # Determine if cointegrated using MacKinnon critical values
    is_cointegrated = adf_statistic < critical_values["5%"]

    # Calculate approximate p-value for cointegration
    # Note: ADF p-value is for standard ADF, not cointegration test
    p_value = _approximate_cointegration_pvalue(adf_statistic, 2)

    return EngleGrangerResult(
        statistic=adf_statistic,
        p_value=p_value,
        is_cointegrated=is_cointegrated,
        hedge_ratio=hedge_ratio,
        intercept=intercept,
        residuals=residuals,
        r_squared=r_squared,
        critical_values=critical_values,
    )


def _approximate_cointegration_pvalue(t_stat: float, num_vars: int) -> float:
    """
    Approximate p-value for cointegration test

    Uses more conservative critical values than standard ADF.
    This is a rough approximation based on critical value ranges.
    """
    cv = COINTEGRATION_CRITICAL_VALUES.get(num_vars, COINTEGRATION_CRITICAL_VALUES[2])

    if t_stat <= cv["1%"]:
        return max(0.001, 0.001 + (t_stat - cv["1%"]) * 0.001)
    elif t_stat <= cv["5%"]:
        range_val = cv["1%"] - cv["5%"]
        position = (cv["1%"] - t_stat) / range_val
        return 0.01 + position * 0.04
    elif t_stat <= cv["10%"]:
        range_val = cv["5%"] - cv["10%"]
        position = (cv["5%"] - t_stat) / range_val
        return 0.05 + position * 0.05
    elif t_stat <= 0:
        range_val = abs(cv["10%"])
        position = (cv["10%"] - t_stat) / range_val
        return min(0.5, 0.10 + position * 0.40)
    else:
        return min(0.99, 0.5 + t_stat * 0.1)


def build_spread(
    prices_y: np.ndarray,
    prices_x: np.ndarray,
    hedge_ratio: float,
    intercept: float = 0.0,
) -> np.ndarray:
    """
    Build spread from two price series using Engle-Granger hedge ratio

    Spread_t = Y_t - α - β * X_t

    Args:
        prices_y: Y series (typically the more volatile asset)
        prices_x: X series (typically the less volatile asset)
        hedge_ratio: β from cointegrating regression
        intercept: α from cointegrating regression

    Returns:
        Spread series as numpy array
    """
    return prices_y - intercept - hedge_ratio * prices_x


def calculate_z_score(
    spread: np.ndarray,
    lookback: Optional[int] = None,
) -> Tuple[np.ndarray, float, float, float]:
    """
    Calculate Z-Score of spread

    Z_t = (Spread_t - μ) / σ

    Args:
        spread: Spread series
        lookback: Optional lookback window for rolling mean/std
                 If None, uses entire series

    Returns:
        Tuple of (z_score_series, current_z_score, mean_spread, std_spread)
    """
    if len(spread) < 2:
        return np.array([]), 0.0, 0.0, 1.0

    if lookback and lookback < len(spread):
        # Rolling Z-Score using pandas for efficiency
        spread_series = pd.Series(spread)
        rolling_mean = spread_series.rolling(window=lookback).mean()
        rolling_std = spread_series.rolling(window=lookback).std()

        # Calculate Z-Score
        z_score = (spread_series - rolling_mean) / rolling_std
        z_score = z_score.fillna(0).values

        # Get current values (last window)
        current_z_score = z_score[-1] if len(z_score) > 0 else 0.0
        mean_spread = rolling_mean.iloc[-1] if len(rolling_mean) > 0 else 0.0
        std_spread = rolling_std.iloc[-1] if len(rolling_std) > 0 else 1.0

    else:
        # Static Z-Score using all data
        mean_spread = np.mean(spread)
        std_spread = np.std(spread, ddof=1)

        if std_spread == 0:
            z_score = np.zeros_like(spread)
            std_spread = 1.0
        else:
            z_score = (spread - mean_spread) / std_spread

        current_z_score = z_score[-1] if len(z_score) > 0 else 0.0

    return z_score, current_z_score, mean_spread, std_spread


def calculate_lookback_bars(lookback_hours: float, interval: str) -> int:
    """
    Calculate lookback period in bars based on time duration and interval

    This fixes the bug where 20 bars at 5min (1.67h) vs 15min (5h) gives
    vastly different results.

    Args:
        lookback_hours: Desired lookback period in hours
        interval: Bar interval ('5min', '15min', '1h', '1d', etc.)

    Returns:
        Number of bars for the lookback period

    Examples:
        >>> calculate_lookback_bars(24.0, '5min')
        288  # 24 hours * 60 min / 5 min
        >>> calculate_lookback_bars(24.0, '15min')
        96   # 24 hours * 60 min / 15 min
        >>> calculate_lookback_bars(24.0, '1h')
        24   # 24 hours / 1 hour
    """
    # Parse interval to minutes
    interval_minutes = _parse_interval_to_minutes(interval)

    # Calculate bars needed
    lookback_minutes = lookback_hours * 60
    bars = int(lookback_minutes / interval_minutes)

    # Ensure minimum of 10 bars
    return max(10, bars)


def _parse_interval_to_minutes(interval: str) -> float:
    """
    Parse interval string to minutes

    Supported formats:
    - '5min' or '5m' → 5 minutes
    - '1h' → 60 minutes
    - '4h' → 240 minutes
    - '1d' → 1440 minutes
    - '1w' → 10080 minutes
    """
    interval = interval.lower().strip()

    # Minute intervals
    if interval.endswith('min') or interval.endswith('m'):
        return float(interval.rstrip('minm'))

    # Hour intervals
    if interval.endswith('h'):
        hours = float(interval.rstrip('h'))
        return hours * 60

    # Day intervals
    if interval.endswith('d'):
        days = float(interval.rstrip('d'))
        return days * 1440

    # Week intervals
    if interval.endswith('w'):
        weeks = float(interval.rstrip('w'))
        return weeks * 10080

    # Default to 1 day if unparseable
    return 1440
