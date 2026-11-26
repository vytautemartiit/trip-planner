import time

import requests

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
CACHE_SECONDS = 60 * 60  # ECB rates change once a day, so an hour is plenty

_rate_cache = {}  # currency -> (rate, fetched_at)

# The currencies the app offers
CURRENCIES = ["EUR", "USD", "GBP", "PLN", "CZK"]

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


def get_rates():
    """
    Visi programos valiutų kursai iš EUR vienu užklausimu, pvz. {"EUR": 1.0, "USD": 1.08, ...}.
    """
    others = [c for c in CURRENCIES if c != "EUR"]
    now = time.time()
    if all(c in _rate_cache and now - _rate_cache[c][1] < CACHE_SECONDS for c in others):
        return {"EUR": 1.0, **{c: _rate_cache[c][0] for c in others}}

    response = requests.get(FRANKFURTER_URL, params={"base": "EUR", "symbols": ",".join(others)}, timeout=10)
    response.raise_for_status()
    rates = response.json()["rates"]
    for c in others:
        _rate_cache[c] = (rates[c], now)
    return {"EUR": 1.0, **{c: rates[c] for c in others}}


def to_eur(amount, currency):
    """
    Konvertuoja sumą iš nurodytos valiutos į EUR (pvz. biudžetą, įvestą kronomis).
    """
    return amount / get_exchange_rate(currency)


def convert_amount(amount_eur, target_currency):
    """
    Konvertuoja sumą iš EUR į nurodytą valiutą.
    """
    rate = get_exchange_rate(target_currency)
    return round(amount_eur * rate, 2)