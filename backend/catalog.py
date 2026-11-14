# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Variable catalog. Each entry was checked against the live sources (see notes below).

has_map: the parameter exists in the MERRA-2 monthly Zarr store.
has_witness: Open-Meteo's ERA5 archive has a daily variable measuring the same quantity
(ERA5_DAILY); soil wetness and column water vapour have no like-for-like ERA5 variable.
POWER point API and the Zarr store were checked to agree on units (PS differs: kPa vs hPa, so it is left out).
"""

START_YEAR = 1981
END_YEAR = 2025  # last full year available in NASA POWER (checked 2026-11)

# POWER param -> Open-Meteo archive daily variable
ERA5_DAILY = {
    "T2M": "temperature_2m_mean",
    "T2M_MAX": "temperature_2m_max",
    "T2M_MIN": "temperature_2m_min",
    "PRECTOTCORR": "precipitation_sum",
    "RH2M": "relative_humidity_2m_mean",
    "WS10M": "wind_speed_10m_mean",
    "ALLSKY_SFC_SW_DWN": "shortwave_radiation_sum",
    "CLOUD_AMT": "cloud_cover_mean",
}

_MERRA = "NASA POWER (MERRA-2)"
_CERES = "NASA POWER (CERES SYN1deg)"


def _v(id, name, source, param, unit, description, why, start_year=START_YEAR, has_map=True):
    return {
        "id": id, "name": name, "source": source, "param": param, "unit": unit,
        "description": description, "why_it_matters": why,
        "start_year": start_year, "end_year": END_YEAR,
        "has_map": has_map, "has_witness": param in ERA5_DAILY,
    }


VARIABLES = [
    _v("t2m", "Surface air temperature", _MERRA, "T2M", "°C",
       "Monthly mean air temperature 2 metres above the ground.",
       "The most direct indicator of global warming; long-term rises reshape ecosystems and sea level."),
    _v("t2m_max", "Daily maximum temperature", _MERRA, "T2M_MAX", "°C",
       "Monthly mean of the daily highest air temperature at 2 metres.",
       "Hot afternoons drive heat stress, crop damage, and energy demand."),
    _v("t2m_min", "Daily minimum temperature", _MERRA, "T2M_MIN", "°C",
       "Monthly mean of the daily lowest air temperature at 2 metres.",
       "Warmer nights give people and ecosystems less recovery time and change frost patterns."),
    _v("prectotcorr", "Precipitation", _MERRA, "PRECTOTCORR", "mm/day",
       "Rain and snow reaching the ground, as a daily average (bias-corrected).",
       "Shifts in rainfall mean more droughts in some places and floods in others."),
    _v("gwettop", "Surface soil wetness", _MERRA, "GWETTOP", "fraction (0-1)",
       "Saturation of the top soil layer: 0 is completely dry, 1 is fully wet.",
       "Basic gauge of agricultural drought and wildfire risk."),
    _v("rh2m", "Relative humidity", _MERRA, "RH2M", "%",
       "Moisture in the air at 2 metres as a share of what the air can hold.",
       "Dry air raises wildfire danger and evaporation; humid heat strains the human body."),
    _v("ws10m", "Wind speed", _MERRA, "WS10M", "m/s",
       "Wind speed 10 metres above the ground.",
       "Winds move heat and moisture and set the potential for wind power and storm damage."),
    _v("tqv", "Total column water vapour", _MERRA, "TQV", "kg/m²",
       "Total water vapour in the atmosphere above a point, from ground to space.",
       "Warmer air holds more water vapour, which amplifies warming and fuels heavy rain."),
    _v("allsky_sw", "Surface solar radiation", _CERES, "ALLSKY_SFC_SW_DWN", "MJ/m²/day",
       "Sunlight reaching the surface under real sky conditions (clouds included), daily average.",
       "Sets solar-power yield and the energy that drives surface warming.",
       start_year=1984, has_map=False),
    _v("cloud_amt", "Cloud cover", _CERES, "CLOUD_AMT", "%",
       "Share of the sky covered by cloud, monthly average.",
       "Clouds cool and warm the planet at once; changes in them are a key climate uncertainty.",
       start_year=1984, has_map=False),
]

BY_ID = {v["id"]: v for v in VARIABLES}
