# AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
# Reviewed and directed by the project author.
"""Variable catalog. Each entry was checked against the live sources (see notes below).

has_map: the parameter exists in the MERRA-2 monthly Zarr store.
has_witness: Open-Meteo's ERA5 archive has a daily variable measuring the same quantity
(ERA5_DAILY); soil wetness and column water vapour have no like-for-like ERA5 variable.
POWER point API and the Zarr store were checked to agree on units (PS differs: kPa vs hPa, so it is left out).
EVPTRNS differs too (point API MJ/m²/day, Zarr W/m²); power_grid converts the grid with the exact factor
(GRID_SCALE), and the two were checked to agree at a land cell (2026-11).
Ocean, ice and land-surface variables (TS, FRSEAICE, FRSNO, EVPTRNS) come from the same MERRA-2 store.
MERRA-2 sea surface temperature and sea ice are prescribed from satellite-based analyses, so over the
ocean these are observations-based fields, not free model output.
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

# Zarr grid -> point-API units, where the two differ (1 W/m² = 0.0864 MJ/m²/day)
GRID_SCALE = {"EVPTRNS": 0.0864}
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
       "Average air temperature measured about 2 metres above the ground (head height), as a monthly mean.",
       "The most direct sign of global warming. Long-term rises change ecosystems, melt ice, and raise sea level."),
    _v("t2m_max", "Daily maximum temperature", _MERRA, "T2M_MAX", "°C",
       "The hottest temperature of each day, averaged over the month.",
       "Hotter afternoons mean more heat stress, crop damage, and demand for cooling."),
    _v("t2m_min", "Daily minimum temperature", _MERRA, "T2M_MIN", "°C",
       "The coolest temperature of each night, averaged over the month.",
       "Warmer nights give people and nature less time to cool down, and mean fewer frosty days."),
    _v("prectotcorr", "Precipitation", _MERRA, "PRECTOTCORR", "mm/day",
       "Rain and snow that reaches the ground, as an average per day (satellite estimate adjusted with rain-gauge data).",
       "Changing rainfall can mean more droughts in some places and more floods in others."),
    _v("gwettop", "Surface soil wetness", _MERRA, "GWETTOP", "fraction (0-1)",
       "How wet the top layer of soil is: 0 is completely dry, 1 is soaked.",
       "A basic gauge of drought for farmers and of wildfire risk."),
    _v("rh2m", "Relative humidity", _MERRA, "RH2M", "%",
       "How much water vapour the air holds, as a share of the most it could hold at that temperature.",
       "Dry air raises wildfire danger and dries out soil; humid heat is harder for the human body to cope with."),
    _v("ws10m", "Wind speed", _MERRA, "WS10M", "m/s",
       "Average wind speed measured 10 metres above the ground.",
       "Wind moves heat and moisture around, and decides how much power wind turbines can make and how damaging storms are."),
    _v("tqv", "Total column water vapour", _MERRA, "TQV", "kg/m²",
       "All the water vapour in the air above a spot, from the ground up to space, shown as its weight per square metre.",
       "Warmer air holds more water vapour. Vapour traps heat, which adds to warming, and it feeds heavy rain."),
    _v("ts", "Sea and land surface temperature", _MERRA, "TS", "°C",
       "Temperature of the surface itself: the sea surface over the oceans, the ground over land.",
       "Ocean surface warming drives marine heatwaves, coral bleaching and stronger storms, and the ocean stores most of the extra heat."),
    _v("frseaice", "Sea ice cover", _MERRA, "FRSEAICE", "fraction (0-1)",
       "The share of the sea surface covered by ice, from 0 (open water) to 1 (fully frozen).",
       "Sea ice reflects sunlight. As it melts, darker water absorbs more heat, which speeds up polar warming."),
    _v("frsno", "Snow cover", _MERRA, "FRSNO", "fraction (0-1)",
       "The share of the land covered by snow, from 0 (bare) to 1 (fully snow-covered).",
       "Snow keeps the ground cool by reflecting sunlight, and melting snow feeds rivers and drinking water in spring."),
    _v("evptrns", "Evapotranspiration", _MERRA, "EVPTRNS", "MJ/m²/day",
       "Water returned to the air from soil, lakes and plants (plants 'breathe out' water through their leaves), measured as the energy it takes.",
       "It shows how hard plants and soils are working: more means a greener or wetter surface, less can mean drought stress on vegetation."),
    _v("allsky_sw", "Surface solar radiation", _CERES, "ALLSKY_SFC_SW_DWN", "MJ/m²/day",
       "Sunlight that actually reaches the ground, with clouds taken into account, as a daily average.",
       "Decides how much power solar panels make and how much energy warms the surface.",
       start_year=1984, has_map=False),
    _v("cloud_amt", "Cloud cover", _CERES, "CLOUD_AMT", "%",
       "How much of the sky is covered by cloud, as a monthly average.",
       "Clouds both cool the planet (by reflecting sunlight) and warm it (by trapping heat), so changes in cloud are one of the biggest uncertainties in climate science.",
       start_year=1984, has_map=False),
]

BY_ID = {v["id"]: v for v in VARIABLES}
