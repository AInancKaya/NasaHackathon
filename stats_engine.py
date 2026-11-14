"""Mann-Kendall, Sen's slope, t-test and linear regression (with 95% CI)."""
import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats

ALPHA = 0.05
MIN_MONTHS = 36


def analyze_trend(series: pd.Series, label: str, unit: str) -> dict:
    s = series.dropna().astype(float)
    n = len(s)
    if n < MIN_MONTHS:
        raise ValueError(f"En az {MIN_MONTHS} aylık veri gerekli (mevcut: {n}).")

    t = (s.index.year + (s.index.month - 1) / 12.0).values

    # Mann-Kendall (seasonal, monthly) + Sen's slope; slope is per month
    mkr = mk.seasonal_test(s.values, period=12)
    sen_decade = float(mkr.slope) * 120.0

    # Regression on deseasonalised anomalies -> slope, p, 95% CI band
    anom = s - s.groupby(s.index.month).transform("mean")
    lr = stats.linregress(t, anom.values)
    resid = anom.values - (lr.intercept + lr.slope * t)
    se = np.sqrt(resid @ resid / (n - 2))
    tc = stats.t.ppf(1 - ALPHA / 2, n - 2)
    half = tc * se * np.sqrt(1 / n + (t - t.mean()) ** 2 / ((t - t.mean()) ** 2).sum())
    fit = s.mean() + lr.slope * (t - t.mean())
    trend = pd.DataFrame({"fit": fit, "lo": fit - half, "hi": fit + half}, index=s.index)

    # Welch t-test: annual means, first half vs second half of the record
    annual = anom.groupby(s.index.year).mean()
    h = len(annual) // 2
    t_stat, t_p = stats.ttest_ind(annual.iloc[:h], annual.iloc[-h:], equal_var=False)

    mk_p = float(mkr.p)
    sig = mk_p < ALPHA
    direction = {"increasing": "artıyor", "decreasing": "azalıyor"}.get(mkr.trend, "değişmiyor")
    changing = f"{label} {direction}." if sig else f"{label} için anlamlı bir değişim yok."

    return {
        "what_is_changing": changing,
        "how_much": f"Sen eğimi: {sen_decade:+.3f} {unit} / on yıl",
        "is_significant": (f"Significant (p = {mk_p:.4f} < 0.05)" if sig
                           else f"Not Significant (p = {mk_p:.4f} ≥ 0.05)"),
        "significant": sig,
        "trend_direction": mkr.trend,
        "mk_p": mk_p,
        "mk_tau": float(mkr.Tau),
        "sen_slope_per_decade": sen_decade,
        "reg_slope_per_decade": lr.slope * 10.0,
        "reg_p": float(lr.pvalue),
        "reg_r2": float(lr.rvalue ** 2),
        "reg_ci95_per_decade": ((lr.slope - tc * lr.stderr) * 10.0,
                                (lr.slope + tc * lr.stderr) * 10.0),
        "ttest_t": float(t_stat),
        "ttest_p": float(t_p),
        "n": n,
        "trend": trend,
    }
