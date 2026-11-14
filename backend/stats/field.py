# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Per-cell seasonal Mann-Kendall + seasonal Sen slope over a (time, lat, lon) grid, with
Benjamini-Hochberg FDR across cells, for GET /api/trendmap (see docs/CONTRACT.md).

The time axis must be contiguous monthly steps (NaN for missing months). As in
pymannkendall.seasonal_test, the series is padded with NaN to whole years and reshaped to
(year, month); S, var(S) (with tie correction) and Sen slopes are pooled within each month
column. One row is one year, so the Sen slope is per year and x10 gives per decade.
Results match pymannkendall.seasonal_test cell by cell (see backend/tests/).

trend_field then corrects each cell's p-value for month-to-month persistence, which the seasonal
test ignores and which makes trends look more significant than they are: z is divided by
sqrt((1 + r1) / (1 - r1)), with r1 the lag-1 autocorrelation of the deseasonalised anomalies,
clipped to [0, 0.9] so the correction never makes a cell more significant (an effective-sample-size
correction, Bayley & Hammersley 1946; the lag-1 case of Hamed & Rao 1998, used in the case file).
"""
import warnings

import numpy as np
from scipy.stats import norm

PERIOD = 12
MIN_MONTHS = 36
CHUNK = 512  # cells per block; bounds memory to a few hundred MB on the ~2 degree grid


def _nanmedian_rows(a: np.ndarray) -> np.ndarray:
    """Median of each row ignoring NaN (NaN when a row has no finite value)."""
    srt = np.sort(a, axis=1)  # NaN sorts to the end
    k = np.isfinite(a).sum(axis=1)
    lo = np.take_along_axis(srt, np.maximum((k - 1) // 2, 0)[:, None], axis=1)[:, 0]
    hi = np.take_along_axis(srt, np.maximum(k // 2, 0)[:, None], axis=1)[:, 0]
    return np.where(k > 0, (lo + hi) / 2, np.nan)


def seasonal_mk_sen(data: np.ndarray, period: int = PERIOD) -> tuple:
    """Seasonal MK p-value and seasonal Sen slope (per year) for every cell.

    data: (time, ...) array. Returns (p, slope, n_valid), each shaped like data[0].
    """
    data = np.asarray(data, dtype=float)
    shape = data.shape[1:]
    x = data.reshape(data.shape[0], -1)
    pad = (-x.shape[0]) % period
    if pad:
        x = np.concatenate([x, np.full((pad, x.shape[1]), np.nan)])
    years = x.shape[0] // period
    x = x.reshape(years, period, -1).transpose(2, 0, 1)  # (cell, year, month)
    i, j = np.triu_indices(years, k=1)
    step = (j - i).astype(float)[None, :, None]

    ncell = x.shape[0]
    p = np.full(ncell, np.nan)
    slope = np.full(ncell, np.nan)
    n_valid = np.isfinite(x).sum(axis=(1, 2))
    for c0 in range(0, ncell, CHUNK):
        xc = x[c0:c0 + CHUNK]
        nc = xc.shape[0]
        d = xc[:, j, :] - xc[:, i, :]  # (cell, pair, month)
        s = np.nansum(np.sign(d), axis=(1, 2))
        slope[c0:c0 + nc] = _nanmedian_rows((d / step).reshape(nc, -1))

        # var(S) per month column with tie correction: sum over tie groups of t(t-1)(2t+5),
        # written as a sum over elements of (t-1)(2t+5), t = size of the element's tie group.
        n = np.isfinite(xc).sum(axis=1)  # (cell, month)
        sv = np.sort(xc.transpose(0, 2, 1), axis=-1)  # (cell, month, year), NaN last
        new_run = np.ones(sv.shape, dtype=bool)
        new_run[..., 1:] = sv[..., 1:] != sv[..., :-1]  # NaN != NaN: each NaN is its own run
        run = np.cumsum(new_run, axis=-1) - 1
        run += (np.arange(nc * period) * years).reshape(nc, period, 1)
        t = np.bincount(run.ravel(), minlength=nc * period * years)[run]
        ties = np.where(np.isfinite(sv), (t - 1) * (2 * t + 5), 0).sum(axis=-1)
        var_s = ((n * (n - 1) * (2 * n + 5) - ties) / 18.0).sum(axis=1)

        with np.errstate(divide="ignore", invalid="ignore"):
            z = np.where(s > 0, s - 1, np.where(s < 0, s + 1, 0.0)) / np.sqrt(var_s)
        p[c0:c0 + nc] = np.where(var_s > 0, 2 * norm.sf(np.abs(z)), np.nan)

    return p.reshape(shape), slope.reshape(shape), n_valid.reshape(shape)


def lag1_autocorr(data: np.ndarray, period: int = PERIOD) -> np.ndarray:
    """Lag-1 autocorrelation of the deseasonalised monthly anomalies for every cell (NaN-aware).

    data: (time, ...) contiguous monthly. Returns an array shaped like data[0].
    """
    data = np.asarray(data, dtype=float)
    x = data.reshape(data.shape[0], -1)
    month = np.arange(x.shape[0]) % period
    a = x.copy()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)  # all-NaN month columns (ocean in soil wetness)
        for m in range(period):
            a[month == m] -= np.nanmean(x[month == m], axis=0)
    a0, a1 = a[:-1], a[1:]
    ok = np.isfinite(a0) & np.isfinite(a1)
    num = np.where(ok, a0 * a1, 0).sum(axis=0)
    den = np.where(np.isfinite(a), a * a, 0).sum(axis=0)
    with np.errstate(divide="ignore", invalid="ignore"):
        r1 = np.where(den > 0, num / den, np.nan)
    return r1.reshape(data.shape[1:])


def correct_p(p: np.ndarray, r1: np.ndarray) -> np.ndarray:
    """Two-sided p-value with z deflated by the lag-1 variance inflation factor (r1 clipped to [0, 0.9])."""
    r = np.clip(np.nan_to_num(r1, nan=0.0), 0.0, 0.9)
    z = norm.isf(np.asarray(p, dtype=float) / 2)
    return 2 * norm.sf(z / np.sqrt((1 + r) / (1 - r)))


def bh_fdr(p: np.ndarray, q: float = 0.05) -> np.ndarray:
    """Benjamini-Hochberg: True where the hypothesis is rejected at FDR q. NaN p -> False."""
    p = np.asarray(p, dtype=float)
    out = np.zeros(p.shape, dtype=bool)
    ok = np.isfinite(p)
    pv = p[ok]
    m = pv.size
    if m == 0:
        return out
    order = np.argsort(pv)
    below = np.nonzero(pv[order] <= q * np.arange(1, m + 1) / m)[0]
    if below.size:
        rejected = np.zeros(m, dtype=bool)
        rejected[order[:below[-1] + 1]] = True
        out[ok] = rejected
    return out


def trend_field(data: np.ndarray, q: float = 0.05) -> dict:
    """`slope` (Sen, per decade) and `sig` (autocorrelation-corrected, then BH-FDR at q) as [lat][lon] lists for /api/trendmap.

    data: (time, lat, lon), contiguous monthly. Cells with fewer than MIN_MONTHS valid months
    are null in both outputs and excluded from the FDR.
    """
    p, slope, n_valid = seasonal_mk_sen(data)
    p = correct_p(p, lag1_autocorr(data))
    usable = (n_valid >= MIN_MONTHS) & np.isfinite(p) & np.isfinite(slope)
    p = np.where(usable, p, np.nan)
    sig = bh_fdr(p, q)
    slope_out = [[float(slope[a, b]) * 10.0 if usable[a, b] else None
                  for b in range(slope.shape[1])] for a in range(slope.shape[0])]
    sig_out = [[bool(sig[a, b]) if usable[a, b] else None
                for b in range(sig.shape[1])] for a in range(sig.shape[0])]
    return {"slope": slope_out, "sig": sig_out}
