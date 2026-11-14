# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Tests for backend/main.py endpoints. The upstream is replaced by artificial series here only."""
import numpy as np
import pandas as pd
import pytest

from backend import main
from backend.sources import NoDataError


def _fake_point(monkeypatch, values):
    idx = pd.date_range("1981-01-01", "2025-12-01", freq="MS")
    s = pd.Series(values, index=idx, dtype=float)
    monkeypatch.setattr(main.power_point, "fetch_monthly", lambda *a, **k: (s, "2026-01-01T00:00:00Z"))


def test_series_never_changing_is_a_clear_not_found(monkeypatch):
    # e.g. sea ice over land (always 0) or soil wetness over the ocean (always 1)
    _fake_point(monkeypatch, np.zeros(540))
    with pytest.raises(NoDataError, match="never changes"):
        main.series("frseaice", 48.85, 2.35, None, None, None)


def test_series_with_undefined_hamed_rao_p_is_a_clear_error(monkeypatch):
    # pymannkendall's Hamed-Rao variance can turn negative on heavily tied records (seen on real
    # MERRA-2 snow cover in the Alps), giving p = NaN, which used to crash JSON encoding with a 500.
    from collections import namedtuple
    from backend.stats import trend
    rng = np.random.default_rng(0)
    _fake_point(monkeypatch, rng.normal(0, 1, 540))
    Res = namedtuple("Res", "trend h p z Tau s var_s slope intercept")
    monkeypatch.setattr(trend.mk, "hamed_rao_modification_test",
                        lambda x: Res("no trend", False, float("nan"), float("nan"), 0, 0, -1, 0, 0))
    with pytest.raises(main.InsufficientData, match="cannot be computed"):
        main.series("frsno", 45.0, 10.0, None, None, None)
