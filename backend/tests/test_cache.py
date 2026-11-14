# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Tests for cached_blob (computed-response cache). Artificial inputs are used here only."""
import os

from backend import cache


def test_blob_is_computed_once_then_served_from_disk(tmp_path, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    calls = []

    def compute():
        calls.append(1)
        return b"{}"

    assert cache.cached_blob("m.json", compute) == b"{}"
    assert cache.cached_blob("m.json", compute) == b"{}"
    assert len(calls) == 1


def test_blob_is_recomputed_when_raw_grid_is_newer(tmp_path, monkeypatch):
    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    cache.cached_blob("m.json", lambda: b"old")
    grid = tmp_path / "grid.npz"
    grid.write_bytes(b"x")
    mtime = (tmp_path / "m.json").stat().st_mtime + 10
    os.utime(grid, (mtime, mtime))
    assert cache.cached_blob("m.json", lambda: b"new", newer_than="grid.npz") == b"new"
