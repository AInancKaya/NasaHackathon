"""NASA POWER monthly point time series. Real data only; raises on any failure."""
import numpy as np
import pandas as pd
import requests

API_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
FILL_VALUE = -999.0

VARIABLES = {
    "Sıcaklık": {
        "param": "T2M", "unit": "°C", "label": "Yüzey Sıcaklığı",
        "desc": "Yerden 2 metre yükseklikteki hava sıcaklığı (MERRA-2). "
                "Uzun vadeli artış küresel ısınmanın doğrudan göstergesidir.",
    },
    "Yağış": {
        "param": "PRECTOTCORR", "unit": "mm/gün", "label": "Yağış",
        "desc": "Yere düşen yağmur ve kar miktarının günlük ortalaması (MERRA-2, düzeltilmiş). "
                "Kuraklık ve sel risklerini izlemek için kullanılır.",
    },
    "Nem": {
        "param": "GWETTOP", "unit": "0-1", "label": "Üst Toprak Nemi",
        "desc": "Toprağın en üst katmanının doygunluk oranı (0 = kuru, 1 = tamamen ıslak). "
                "Tarım ve kuraklık izleme için temel göstergedir.",
    },
}


def fetch_monthly(lat: float, lon: float, start_year: int, end_year: int,
                  param: str, timeout: int = 60) -> pd.Series:
    """Return monthly pd.Series (DatetimeIndex) for one POWER parameter.

    Raises ValueError on bad input, RuntimeError if API status != 200 or no data.
    """
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Enlem -90..90, boylam -180..180 aralığında olmalı.")
    if start_year > end_year:
        raise ValueError("Başlangıç yılı bitiş yılından büyük olamaz.")

    resp = requests.get(API_URL, params={
        "parameters": param, "community": "AG",
        "latitude": lat, "longitude": lon,
        "start": start_year, "end": end_year, "format": "JSON",
    }, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"NASA POWER HTTP {resp.status_code}: {resp.text[:200]}")

    values = resp.json()["properties"]["parameter"][param]
    # keys: YYYYMM; month 13 = annual mean -> drop
    items = {k: v for k, v in values.items() if not k.endswith("13")}
    s = pd.Series(items, dtype=float)
    s.index = pd.to_datetime(s.index, format="%Y%m")
    s = s.sort_index().replace(FILL_VALUE, np.nan).dropna()
    if s.empty:
        raise RuntimeError("Seçilen konum/tarih için NASA POWER veri döndürmedi.")
    s.name = param
    return s
