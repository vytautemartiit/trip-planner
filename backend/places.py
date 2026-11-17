"""
Facts about each destination that the backend needs: country code, English names, airport codes
(used to check uploaded tickets), the GOV.UK travel-advice page and a few yearly events.
Keys are the destination names from data.py ("Praha, Čekija").
"""

from data import destinations

PLACES = {
    "Barselona, Ispanija": {
        "city": "Barcelona", "country": "Spain", "iso": "ES", "govuk": "spain",
        "names": ["Barcelona", "Barselona", "BCN", "El Prat"],
    },
    "Roma, Italija": {
        "city": "Rome", "country": "Italy", "iso": "IT", "govuk": "italy",
        "names": ["Rome", "Roma", "FCO", "CIA", "Fiumicino", "Ciampino"],
    },
    "Lisabona, Portugalija": {
        "city": "Lisbon", "country": "Portugal", "iso": "PT", "govuk": "portugal",
        "names": ["Lisbon", "Lisboa", "Lisabona", "LIS"],
    },
    "Praha, Čekija": {
        "city": "Prague", "country": "Czechia", "iso": "CZ", "govuk": "czechia",
        "names": ["Prague", "Praha", "Prag", "PRG"],
    },
    "Budapeštas, Vengrija": {
        "city": "Budapest", "country": "Hungary", "iso": "HU", "govuk": "hungary",
        "names": ["Budapest", "Budapeštas", "BUD"],
    },
    "Krokuva, Lenkija": {
        "city": "Krakow", "country": "Poland", "iso": "PL", "govuk": "poland",
        "names": ["Krakow", "Kraków", "Cracow", "Krokuva", "KRK", "Balice"],
    },
    "Amsterdamas, Nyderlandai": {
        "city": "Amsterdam", "country": "Netherlands", "iso": "NL", "govuk": "netherlands",
        "names": ["Amsterdam", "Amsterdamas", "AMS", "Schiphol"],
    },
    "Atėnai, Graikija": {
        "city": "Athens", "country": "Greece", "iso": "GR", "govuk": "greece",
        "names": ["Athens", "Athina", "Athinai", "Atėnai", "ATH"],
    },
}

assert set(PLACES) == {d["name"] for d in destinations}, "places.py must cover every destination in data.py"

# Well-known events that happen every year. Dates move a little from year to year, so they are
# shown as "yearly" with a link to check. (month, day) ranges, inclusive; a range may wrap the new year.
YEARLY_EVENTS = {
    "Barselona, Ispanija": [
        ("Sant Jordi – books and roses in the streets", (4, 23), (4, 23)),
        ("Festa Major de Gràcia – decorated streets", (8, 15), (8, 21)),
        ("La Mercè – the city's biggest festival", (9, 20), (9, 25)),
    ],
    "Roma, Italija": [
        ("Natale di Roma – Rome's birthday parades", (4, 21), (4, 21)),
        ("Festa della Repubblica – parade on Via dei Fori Imperiali", (6, 2), (6, 2)),
        ("Christmas market on Piazza Navona", (12, 1), (1, 6)),
    ],
    "Lisabona, Portugalija": [
        ("Festas de Lisboa – Santo António street parties", (6, 1), (6, 30)),
        ("Christmas lights and Wonderland Lisboa", (12, 1), (1, 1)),
    ],
    "Praha, Čekija": [
        ("Prague Spring classical music festival", (5, 12), (6, 3)),
        ("Signal light festival", (10, 10), (10, 20)),
        ("Christmas markets on Old Town Square", (11, 28), (1, 6)),
    ],
    "Budapeštas, Vengrija": [
        ("Budapest Spring Festival", (4, 1), (4, 30)),
        ("Sziget music festival", (8, 5), (8, 12)),
        ("St Stephen's Day fireworks over the Danube", (8, 20), (8, 20)),
        ("Christmas fair on Vörösmarty Square", (11, 14), (12, 31)),
    ],
    "Krokuva, Lenkija": [
        ("Wianki – midsummer festival by the Vistula", (6, 20), (6, 24)),
        ("Jewish Culture Festival in Kazimierz", (6, 24), (7, 3)),
        ("Christmas market on the Main Square", (11, 28), (1, 1)),
    ],
    "Amsterdamas, Nyderlandai": [
        ("King's Day – the whole city turns orange", (4, 27), (4, 27)),
        ("Tulip season in and around the city", (4, 1), (5, 10)),
        ("Amsterdam Light Festival on the canals", (11, 27), (1, 18)),
    ],
    "Atėnai, Graikija": [
        ("Athens & Epidaurus Festival – theatre under the stars", (6, 1), (8, 31)),
        ("Open-air summer cinemas", (5, 15), (9, 30)),
        ("Ochi Day parades", (10, 28), (10, 28)),
    ],
}
