import time

import requests

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_SECONDS = 60 * 60  # ECB rates change once a day, so an hour is plenty

_rate_cache = {}  # currency -> (rate, fetched_at)

def get_exchange_rate(target_currency):
    """
    Gauna valiutos kursą iš EUR į nurodytą valiutą.
    Kursas išsaugomas valandai, kad nereikėtų kreiptis į API dėl kiekvienos kelionės.
    """
    if target_currency == "EUR":
        return 1.0

    cached = _rate_cache.get(target_currency)
    if cached and time.time() - cached[1] < CACHE_SECONDS:
        return cached[0]

    response = requests.get(FRANKFURTER_URL, params={
        "base": "EUR",
        "symbols": target_currency
    }, timeout=10)
    response.raise_for_status()

    rate = response.json()["rates"][target_currency]
    _rate_cache[target_currency] = (rate, time.time())
    return rate


def convert_amount(amount_eur, target_currency):
    """
    Konvertuoja sumą iš EUR į nurodytą valiutą.
    """
    rate = get_exchange_rate(target_currency)
    return round(amount_eur * rate, 2)