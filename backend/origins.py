"""
Where people can fly from.

The prices in data.py are real-ish fares from Vilnius. For every other departure city we estimate the
fare from the flight distance, scaled by how far the Vilnius fare is from the same estimate. That keeps
cheap routes cheap and long routes expensive, but it is an estimate, so results say so ("flight_estimated").
"""

from math import asin, cos, radians, sin, sqrt

from data import destinations

DEFAULT_ORIGIN = "VNO"

# code -> airport city. "destination" links an origin that is also one of our destinations,
# so a trip from Prague never suggests flying to Prague.
ORIGINS = {
    "VNO": {"city": "Vilnius", "country": "Lithuania", "iso": "LT", "lat": 54.6872, "lng": 25.2797},
    "KUN": {"city": "Kaunas", "country": "Lithuania", "iso": "LT", "lat": 54.8985, "lng": 23.9036},
    "PLQ": {"city": "Palanga", "country": "Lithuania", "iso": "LT", "lat": 55.9175, "lng": 21.0686},
    "RIX": {"city": "Riga", "country": "Latvia", "iso": "LV", "lat": 56.9496, "lng": 24.1052},
    "TLL": {"city": "Tallinn", "country": "Estonia", "iso": "EE", "lat": 59.4370, "lng": 24.7536},
    "HEL": {"city": "Helsinki", "country": "Finland", "iso": "FI", "lat": 60.1699, "lng": 24.9384},
    "ARN": {"city": "Stockholm", "country": "Sweden", "iso": "SE", "lat": 59.3293, "lng": 18.0686},
    "OSL": {"city": "Oslo", "country": "Norway", "iso": "NO", "lat": 59.9139, "lng": 10.7522},
    "CPH": {"city": "Copenhagen", "country": "Denmark", "iso": "DK", "lat": 55.6761, "lng": 12.5683},
    "WAW": {"city": "Warsaw", "country": "Poland", "iso": "PL", "lat": 52.2297, "lng": 21.0122},
    "GDN": {"city": "Gdańsk", "country": "Poland", "iso": "PL", "lat": 54.3520, "lng": 18.6466},
    "BER": {"city": "Berlin", "country": "Germany", "iso": "DE", "lat": 52.5200, "lng": 13.4050},
    "FRA": {"city": "Frankfurt", "country": "Germany", "iso": "DE", "lat": 50.1109, "lng": 8.6821},
    "MUC": {"city": "Munich", "country": "Germany", "iso": "DE", "lat": 48.1351, "lng": 11.5820},
    "VIE": {"city": "Vienna", "country": "Austria", "iso": "AT", "lat": 48.2082, "lng": 16.3738},
    "ZRH": {"city": "Zurich", "country": "Switzerland", "iso": "CH", "lat": 47.3769, "lng": 8.5417},
    "BRU": {"city": "Brussels", "country": "Belgium", "iso": "BE", "lat": 50.8503, "lng": 4.3517},
    "CDG": {"city": "Paris", "country": "France", "iso": "FR", "lat": 48.8566, "lng": 2.3522},
    "LON": {"city": "London", "country": "United Kingdom", "iso": "GB", "lat": 51.5072, "lng": -0.1276},
    "DUB": {"city": "Dublin", "country": "Ireland", "iso": "IE", "lat": 53.3498, "lng": -6.2603},
    "MAD": {"city": "Madrid", "country": "Spain", "iso": "ES", "lat": 40.4168, "lng": -3.7038},
    "MXP": {"city": "Milan", "country": "Italy", "iso": "IT", "lat": 45.4642, "lng": 9.1900},
    "KIV": {"city": "Chișinău", "country": "Moldova", "iso": "MD", "lat": 47.0105, "lng": 28.8638},
    "KBP": {"city": "Kyiv", "country": "Ukraine", "iso": "UA", "lat": 50.4501, "lng": 30.5234},
    "BCN": {"city": "Barcelona", "country": "Spain", "iso": "ES", "lat": 41.3874, "lng": 2.1686, "destination": "Barselona, Ispanija"},
    "FCO": {"city": "Rome", "country": "Italy", "iso": "IT", "lat": 41.9028, "lng": 12.4964, "destination": "Roma, Italija"},
    "LIS": {"city": "Lisbon", "country": "Portugal", "iso": "PT", "lat": 38.7223, "lng": -9.1393, "destination": "Lisabona, Portugalija"},
    "PRG": {"city": "Prague", "country": "Czechia", "iso": "CZ", "lat": 50.0755, "lng": 14.4378, "destination": "Praha, Čekija"},
    "BUD": {"city": "Budapest", "country": "Hungary", "iso": "HU", "lat": 47.4979, "lng": 19.0402, "destination": "Budapeštas, Vengrija"},
    "KRK": {"city": "Kraków", "country": "Poland", "iso": "PL", "lat": 50.0647, "lng": 19.9450, "destination": "Krokuva, Lenkija"},
    "AMS": {"city": "Amsterdam", "country": "Netherlands", "iso": "NL", "lat": 52.3676, "lng": 4.9041, "destination": "Amsterdamas, Nyderlandai"},
    "ATH": {"city": "Athens", "country": "Greece", "iso": "GR", "lat": 37.9838, "lng": 23.7275, "destination": "Atėnai, Graikija"},
}

# where each destination is, to measure flight distances
DESTINATION_COORDS = {o["destination"]: (o["lat"], o["lng"]) for o in ORIGINS.values() if "destination" in o}
assert set(DESTINATION_COORDS) == {d["name"] for d in destinations}, "every destination needs coordinates"

MIN_FARE = 25


def distance_km(a, b):
    """Great-circle distance between two (lat, lng) points."""
    lat1, lng1, lat2, lng2 = map(radians, (*a, *b))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


def _distance_fare(km):
    # a rough low-cost fare: a fixed part (airport fees) plus a part that grows with distance
    return 20 + 0.03 * km


def flight_price(destination, origin=DEFAULT_ORIGIN):
    """Fare from `origin` to the destination dict. Exact for Vilnius, estimated for everywhere else."""
    if origin == DEFAULT_ORIGIN:
        return destination["flight_price"]
    home = ORIGINS[DEFAULT_ORIGIN]
    start = ORIGINS[origin]
    to = DESTINATION_COORDS[destination["name"]]
    # how much cheaper/dearer the real Vilnius fare is than the distance formula says
    factor = destination["flight_price"] / _distance_fare(distance_km((home["lat"], home["lng"]), to))
    estimate = _distance_fare(distance_km((start["lat"], start["lng"]), to)) * factor
    return max(MIN_FARE, int(round(estimate / 5) * 5))


def available_destinations(origin=DEFAULT_ORIGIN):
    """Every destination except the one you are flying from."""
    home = ORIGINS[origin].get("destination")
    return [d for d in destinations if d["name"] != home]


def clean_origin(code):
    code = (code or DEFAULT_ORIGIN).strip().upper()
    if code not in ORIGINS:
        raise ValueError(f"Unknown departure airport: {code}")
    return code


def origin_list():
    return [{"code": code, **{k: v for k, v in o.items() if k != "destination"}} for code, o in ORIGINS.items()]
