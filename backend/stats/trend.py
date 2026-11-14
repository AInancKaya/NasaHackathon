# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Single-series trend statistics for GET /api/series (see docs/CONTRACT.md).

Ported from stats_engine.analyze_trend, with two fixes:
- The series is reindexed to a complete monthly range before the seasonal test, so a gap no
  longer shifts later months into the wrong season column.
- pymannkendall's seasonal Sen slope is per *year* (one row of the year x month matrix is one
  year), so per decade is x10, not x120.

Choices:
- mk_p_hr: pymannkendall.hamed_rao_modification_test on the deseasonalised monthly anomalies.
  Removing the climatology first stops the seasonal cycle from dominating the rank
  autocorrelation, so the Hamed-Rao variance correction reflects month-to-month persistence.
- sen_ci: rank-based 95% CI of the seasonal Sen slope (Gilbert 1987; Hirsch et al. 1982),
  using the pooled within-season pairwise slopes and the seasonal MK variance of S.
- years_to_detect: Weatherhead et al. (1998), n* = [3.3 sigma_N / |omega_0| *
  sqrt((1 + phi) / (1 - phi))]^(2/3) years, with omega_0 the OLS slope per year on the
  anomalies, sigma_N the standard deviation and phi the lag-1 autocorrelation of the monthly
  OLS residuals. It is the total record length needed to detect the trend (90% probability,
  alpha = 0.05). Null when the trend is already significant.
- segments: exploratory "has the pace changed?" check. A continuous two-segment (hinge) line is fitted to
  the annual mean anomalies, y = a + b t + c max(t - year, 0), trying every break year that leaves at
  least MIN_SEG years on each side and keeping the best fit. Reported: the break year, the slope before
  and after (per decade) and fit_gain, the share of the straight line's residual variance the hinge
  removes. The break year is chosen from the data, so no p-value is given; the UI labels it exploratory.
  (A Pettitt test is not used: on a steadily trending series it reports a "break" in the middle.)
"""
import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats

ALPHA = 0.05
MIN_MONTHS = 36
MIN_SEG = 10  # years on each side of a break


def _seasonal_sen_ci(values: np.ndarray, var_s: float, period: int = 12) -> tuple:
    """95% CI of the seasonal Sen slope, per year (rows of the year x month matrix)."""
    pad = (-len(values)) % period
    x = np.concatenate([values, np.full(pad, np.nan)]).reshape(-1, period)
    i, j = np.triu_indices(x.shape[0], k=1)
    slopes = ((x[j] - x[i]) / (j - i)[:, None]).ravel()
    slopes = np.sort(slopes[np.isfinite(slopes)])
    n = slopes.size
    c = stats.norm.ppf(1 - ALPHA / 2) * np.sqrt(var_s)
    lo = int(np.clip(np.round((n - c) / 2), 1, n))       # M1, 1-based
    hi = int(np.clip(np.round((n + c) / 2) + 1, 1, n))   # M2 + 1, 1-based
    return float(slopes[lo - 1]), float(slopes[hi - 1])


def _lag1_autocorr(r: np.ndarray) -> float:
    a, b = r[:-1], r[1:]
    ok = np.isfinite(a) & np.isfinite(b)
    return float(np.corrcoef(a[ok], b[ok])[0, 1])


def _segments(annual: pd.Series) -> dict | None:
    """Best continuous two-segment fit to annual anomalies (see module docstring); None if too short."""
    annual = annual.dropna()
    t = annual.index.values.astype(float)
    y = annual.values.astype(float)
    if len(y) < 2 * MIN_SEG + 1:
        return None
    lin = np.polyfit(t, y, 1)
    sse_lin = float(((y - np.polyval(lin, t)) ** 2).sum())
    best = None
    for k in range(MIN_SEG, len(t) - MIN_SEG):
        tau = t[k]
        x = np.column_stack([np.ones_like(t), t, np.maximum(t - tau, 0.0)])
        coef, *_ = np.linalg.lstsq(x, y, rcond=None)
        sse = float(((y - x @ coef) ** 2).sum())
        if best is None or sse < best[0]:
            best = (sse, tau, coef)
    sse, tau, (_, b, c) = best
    return {
        "break_year": int(tau),
        "before_per_decade": float(b) * 10.0,
        "after_per_decade": float(b + c) * 10.0,
        "fit_gain": float(1 - sse / sse_lin) if sse_lin > 0 else 0.0,
    }


def _clean(v):
    return None if v is None or not np.isfinite(v) else float(v)


def analyze_trend(series: pd.Series, label: str, unit: str, where: str) -> dict:
    """Trend statistics for a monthly series with a DatetimeIndex.

    Returns plain Python types: `anomaly`, `fit`, `lo`, `hi` (lists aligned to the input index),
    `stats` and `verdict` as in GET /api/series. Raises ValueError below MIN_MONTHS valid months.
    """
    series = series.astype(float)
    s = series.dropna()
    n = len(s)
    if n < MIN_MONTHS:
        raise ValueError(f"At least {MIN_MONTHS} valid months are needed (got {n}).")

    # Complete monthly range so every column of the seasonal test is one calendar month.
    full_idx = pd.date_range(s.index[0], s.index[-1], freq="MS")
    full = s.reindex(full_idx)

    # Seasonal Mann-Kendall + seasonal Sen slope (per year).
    mkr = mk.seasonal_test(full.values, period=12)
    sen_decade = float(mkr.slope) * 10.0
    ci_lo, ci_hi = _seasonal_sen_ci(full.values, float(mkr.var_s))

    # Deseasonalised anomalies and the Hamed-Rao autocorrelation-corrected MK test on them.
    clim = s.groupby(s.index.month).mean()
    anom_full = full - clim.reindex(full.index.month).values
    hr = mk.hamed_rao_modification_test(anom_full.values)
    mk_p_hr = float(hr.p)

    # OLS on anomalies -> slope, p, 95% CI band (time in years).
    anom = anom_full.dropna()
    t = (anom.index.year + (anom.index.month - 1) / 12.0).values
    lr = stats.linregress(t, anom.values)
    resid = anom.values - (lr.intercept + lr.slope * t)
    se = np.sqrt(resid @ resid / (n - 2))
    tc = stats.t.ppf(1 - ALPHA / 2, n - 2)
    t_all = (series.index.year + (series.index.month - 1) / 12.0).values
    half = tc * se * np.sqrt(1 / n + (t_all - t.mean()) ** 2 / ((t - t.mean()) ** 2).sum())
    fit = s.mean() + lr.slope * (t_all - t.mean())

    # Welch t-test: annual mean anomalies, first half vs second half of the record.
    annual = anom.groupby(anom.index.year).mean()
    h = len(annual) // 2
    t_stat, t_p = stats.ttest_ind(annual.iloc[:h], annual.iloc[-h:], equal_var=False)

    significant = mk_p_hr < ALPHA

    # Weatherhead et al. (1998) years needed to detect the trend.
    years_to_detect = None
    if not significant and lr.slope != 0:
        resid_full = pd.Series(resid, index=anom.index).reindex(full_idx).values
        phi = float(np.clip(_lag1_autocorr(resid_full), -0.99, 0.99))
        sigma = float(np.std(resid, ddof=1))
        years_to_detect = _clean(
            (3.3 * sigma / abs(lr.slope) * np.sqrt((1 + phi) / (1 - phi))) ** (2 / 3))

    direction = {"increasing": "is increasing", "decreasing": "is decreasing"}.get(hr.trend)
    what = (f"{label} {direction}." if significant and direction
            else f"{label} shows no significant change.")
    significant_text = (f"Significant (Hamed-Rao Mann-Kendall p = {mk_p_hr:.4f} < 0.05)"
                        if significant
                        else f"Not significant (Hamed-Rao Mann-Kendall p = {mk_p_hr:.4f} >= 0.05)")

    anomaly = anom_full.reindex(series.index)
    return {
        "anomaly": [None if np.isnan(v) else float(v) for v in anomaly.values],
        "fit": [float(v) for v in fit],
        "lo": [float(v) for v in fit - half],
        "hi": [float(v) for v in fit + half],
        "stats": {
            "n": n,
            "mk_p": float(mkr.p),
            "mk_p_hr": mk_p_hr,
            "tau": float(mkr.Tau),
            "trend": hr.trend,
            "sen_per_decade": sen_decade,
            "sen_ci": [ci_lo * 10.0, ci_hi * 10.0],
            "reg_per_decade": float(lr.slope) * 10.0,
            "reg_ci": [float(lr.slope - tc * lr.stderr) * 10.0,
                       float(lr.slope + tc * lr.stderr) * 10.0],
            "reg_p": float(lr.pvalue),
            "reg_r2": float(lr.rvalue ** 2),
            "ttest_t": _clean(t_stat),
            "ttest_p": _clean(t_p),
            "years_to_detect": years_to_detect,
            "segments": _segments(annual),
        },
        "verdict": {
            "what": what,
            "where": where,
            "how_much": (f"Sen's slope: {sen_decade:+.3f} {unit} per decade "
                         f"(95% CI {ci_lo * 10:+.3f} to {ci_hi * 10:+.3f})"),
            "significant": bool(significant),
            "significant_text": significant_text,
        },
    }
