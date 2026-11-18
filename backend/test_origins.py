import pytest

from calculator import calculate_trip_cost, find_destinations_within_budget, find_multi_country_trips
from data import destinations
from origins import ORIGINS, clean_origin, distance_km, flight_price

PRAGUE = next(d for d in destinations if d["name"] == "Praha, Čekija")
LISBON = next(d for d in destinations if d["name"] == "Lisabona, Portugalija")


def test_vilnius_keeps_the_real_fares():
    for d in destinations:
        assert flight_price(d, "VNO") == d["flight_price"]
    assert calculate_trip_cost(PRAGUE, 3)["flight_estimated"] is False


def test_other_origins_are_estimated_and_follow_distance():
    from_berlin = calculate_trip_cost(PRAGUE, 3, "BER")
    assert from_berlin["flight_estimated"] is True
    assert from_berlin["origin"] == "BER"
    # Lisbon is much closer to Madrid than to Helsinki
    assert flight_price(LISBON, "MAD") < flight_price(LISBON, "HEL")
    assert all(flight_price(d, o) >= 25 for d in destinations for o in ORIGINS)


def test_distance_is_about_right():
    vilnius = (ORIGINS["VNO"]["lat"], ORIGINS["VNO"]["lng"])
    prague = (ORIGINS["PRG"]["lat"], ORIGINS["PRG"]["lng"])
    assert 850 < distance_km(vilnius, prague) < 950


def test_you_do_not_fly_to_your_own_city():
    names = [t["destination"] for t in find_destinations_within_budget(100000, 4, "PRG")]
    assert "Praha, Čekija" not in names
    assert len(names) == len(destinations) - 1
    for trip in find_multi_country_trips(100000, 4, 2, "PRG"):
        assert "Praha, Čekija" not in trip["countries"]


def test_clean_origin():
    assert clean_origin(" rix ") == "RIX"
    assert clean_origin(None) == "VNO"
    with pytest.raises(ValueError):
        clean_origin("XXX")


def test_search_endpoints_take_an_origin(client):
    r = client.get("/search", params={"budget": 5000, "days": 4, "origin": "LON"})
    assert r.status_code == 200
    body = r.json()
    assert body["origin"] == "LON"
    assert body["results"] and all(t["flight_estimated"] for t in body["results"])

    r = client.get("/search-multi", params={"budget": 5000, "days": 4, "countries": 2, "origin": "AMS"})
    assert r.status_code == 200
    assert all("Amsterdamas, Nyderlandai" not in t["countries"] for t in r.json()["results"])

    assert client.get("/search", params={"budget": 500, "days": 4, "origin": "NOPE"}).status_code == 400
    assert client.get("/search", params={"budget": 500, "days": 4}).json()["origin"] == "VNO"


def test_origins_endpoint(client):
    origins = client.get("/origins").json()["origins"]
    codes = [o["code"] for o in origins]
    assert "VNO" in codes and "LON" in codes
    assert all({"city", "country", "iso", "lat", "lng"} <= set(o) for o in origins)


def test_destinations_endpoint_prices_follow_the_origin(client):
    from_vilnius = {d["name"]: d for d in client.get("/destinations").json()["destinations"]}
    assert from_vilnius["Praha, Čekija"]["flight_price"] == PRAGUE["flight_price"]
    assert from_vilnius["Praha, Čekija"]["flight_estimated"] is False

    from_prague = client.get("/destinations", params={"origin": "PRG"}).json()
    assert from_prague["origin"] == "PRG"
    names = {d["name"] for d in from_prague["destinations"]}
    assert "Praha, Čekija" not in names and len(names) == len(destinations) - 1


def test_search_says_what_the_cheapest_trip_costs_when_nothing_fits(client):
    body = client.get("/search", params={"budget": 10, "days": 5}).json()
    assert body["count"] == 0
    cheapest = min(
        client.get("/search", params={"budget": 100000, "days": 5}).json()["results"], key=lambda t: t["total_cost"]
    )
    assert body["cheapest_total"] == cheapest["total_cost"]

    multi = client.get("/search-multi", params={"budget": 10, "days": 6, "countries": 2}).json()
    assert multi["count"] == 0 and multi["cheapest_total"] > 10
    assert client.get("/search", params={"budget": 5000, "days": 5}).json()["cheapest_total"] is None


def test_trip_from_a_shared_link(client):
    one = client.get("/trip", params={"stops": "PRG-3"}).json()["trip"]
    assert one["destination"] == "Praha, Čekija" and one["days"] == 3
    assert one == {**calculate_trip_cost(PRAGUE, 3), "total_cost_converted": one["total_cost_converted"]}

    two = client.get("/trip", params={"stops": "prg-3,BUD-2", "origin": "LON"}).json()["trip"]
    assert two["countries"] == ["Praha, Čekija", "Budapeštas, Vengrija"]
    assert two["total_days"] == 5 and two["origin"] == "LON"
    assert two["total_cost"] == sum(s["total_cost"] for s in two["breakdown"])

    for bad in ["", "XXX-3", "PRG-0", "PRG-x", "PRG-3,PRG-2"]:
        assert client.get("/trip", params={"stops": bad}).status_code in (400, 422), bad
    assert client.get("/trip", params={"stops": "PRG-3", "origin": "PRG"}).status_code == 400
