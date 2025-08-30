"""
NOAA Tides & Currents example fetcher (water_level):
Docs: https://api.tidesandcurrents.noaa.gov/api/prod/
"""

from typing import List, Dict
from datetime import datetime
import requests

def fetch_tide_data(station_id: str, begin_date: str, end_date: str) -> List[Dict]:
    """
    station_id: e.g., "8454000"
    begin_date, end_date: "YYYYMMDD"
    Returns: [{'ts': datetime, 'value': float}, ...]
    """
    url = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
    params = {
        "product": "water_level",
        "datum": "MSL",
        "station": station_id,
        "time_zone": "gmt",
        "application": "coastal-threat-alert",
        "format": "json",
        "begin_date": begin_date,
        "end_date": end_date,
        "units": "metric",
    }
    r = requests.get(url, params=params, timeout=20)
    r.raise_for_status()
    data = r.json()
    out = []
    for item in data.get("data", []):
        # item['t'] is like "2021-01-01 00:00"
        ts = datetime.strptime(item["t"], "%Y-%m-%d %H:%M")
        try:
            val = float(item["v"])
        except ValueError:
            continue
        out.append({"ts": ts, "value": val})
    return out
