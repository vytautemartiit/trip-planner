import requests

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"

def get_exchange_rate(target_currency):
    """
    Gauna valiutos kursą iš EUR į nurodytą valiutą.
    """
    if target_currency == "EUR":
        return 1.0

    response = requests.get(FRANKFURTER_URL, params={
        "base": "EUR",
        "symbols": target_currency
    })
    response.raise_for_status()

    data = response.json()
    return data["rates"][target_currency]


def convert_amount(amount_eur, target_currency):
    """
    Konvertuoja sumą iš EUR į nurodytą valiutą.
    """
    rate = get_exchange_rate(target_currency)
    return round(amount_eur * rate, 2)