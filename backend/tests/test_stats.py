# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Tests for backend/stats. Artificial, seeded inputs are used here only (never in product code)."""
import numpy as np
import pandas as pd
import pymannkendall as mk
import pytest

from backend.stats.field import bh_fdr, seasonal_mk_sen, trend_field
from backend.stats.trend import analyze_trend


def _cells(seed=0, n_cells=20, n_months=125):
    rng = np.random.default_rng(seed)
    t = np.arange(n_months)
    season = 5 * np.sin(2 * np.pi * t / 12)
    data = np.empty((n_months, n_cells))
    for c in range(n_cells):
        y = season + rng.normal(0, 1, n_months) + rng.uniform(-0.02, 0.02) * t
        if c % 2:
            y = np.round(y, 1)  # ties
        if c % 3 == 0:
            y[rng.choice(n_months, 10, replace=False)] = np.nan  # gaps
        data[:, c] = y
    return data


def test_seasonal_mk_sen_matches_pymannkendall():
    data = _cells()
    p, slope, _ = seasonal_mk_sen(data)
    for c in range(data.shape[1]):
        ref = mk.seasonal_test(data[:, c], period=12)
        assert p[c] == pytest.approx(ref.p, abs=1e-6)
        assert slope[c] == pytest.approx(ref.slope, abs=1e-6)


def test_seasonal_mk_sen_grid_shape():
    data = _cells().reshape(125, 4, 5)
    res = trend_field(data)
    assert len(res["slope"]) == 4 and len(res["slope"][0]) == 5
    p, slope, _ = seasonal_mk_sen(data)
    ref = mk.seasonal_test(data[:, 2, 3], period=12)
    assert slope[2, 3] == pytest.approx(ref.slope, abs=1e-6)
    assert res["slope"][2][3] == pytest.approx(ref.slope * 10, abs=1e-6)


def test_bh_fdr():
    p = np.array([0.01, 0.04, 0.03, 0.005, np.nan, 0.2])
    # m = 5 valid; sorted 0.005, 0.01, 0.03, 0.04, 0.2 vs 0.01, 0.02, 0.03, 0.04, 0.05
    assert bh_fdr(p).tolist() == [True, True, True, True, False, False]
    p = np.array([0.02, 0.03, 0.5])  # thresholds 0.0167, 0.0333, 0.05 -> largest k is 2
    assert bh_fdr(p).tolist() == [True, True, False]
    assert not bh_fdr(np.array([0.9, 0.8])).any()


def test_analyze_trend_units_and_shape():
    rng = np.random.default_rng(1)
    idx = pd.date_range("2000-01-01", periods=240, freq="MS")
    t = np.arange(240)
    y = 0.01 * t + 3 * np.sin(2 * np.pi * t / 12) + rng.normal(0, 0.2, 240)  # 1.2 per decade
    s = pd.Series(y, index=idx)
    s.iloc[50] = np.nan
    r = analyze_trend(s, "Test", "u", "here")
    st = r["stats"]
    assert st["sen_per_decade"] == pytest.approx(1.2, abs=0.05)
    assert st["sen_ci"][0] < st["sen_per_decade"] < st["sen_ci"][1]
    assert st["reg_per_decade"] == pytest.approx(1.2, abs=0.05)
    assert st["n"] == 239 and st["trend"] == "increasing"
    assert r["verdict"]["significant"] and st["years_to_detect"] is None
    assert len(r["anomaly"]) == len(r["fit"]) == len(r["lo"]) == len(r["hi"]) == 240
    assert r["anomaly"][50] is None


def test_years_to_detect_when_not_significant():
    rng = np.random.default_rng(2)
    idx = pd.date_range("2000-01-01", periods=120, freq="MS")
    s = pd.Series(rng.normal(0, 1, 120), index=idx)
    st = analyze_trend(s, "Test", "u", "here")["stats"]
    if st["mk_p_hr"] >= 0.05:
        assert st["years_to_detect"] > 0
