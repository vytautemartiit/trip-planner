from calculator import calculate_trip_cost, find_destinations_within_budget, find_multi_country_trips

def test_calculate_trip_cost_basic():
    destination = {"name": "Testinis miestas", "flight_price": 50, "hotel_per_night": 30, "daily_cost": 20}
    result = calculate_trip_cost(destination, days=5)

    assert result["flight_cost"] == 50
    assert result["hotel_cost"] == 30 * 4
    assert result["living_cost"] == 20 * 5
    assert result["total_cost"] == 50 + (30 * 4) + (20 * 5)


def test_calculate_trip_cost_single_day():
    destination = {"name": "Testinis miestas", "flight_price": 50, "hotel_per_night": 30, "daily_cost": 20}
    result = calculate_trip_cost(destination, days=1)

    assert result["hotel_cost"] == 0


def test_find_destinations_within_budget_filters_correctly():
    results = find_destinations_within_budget(budget=250, days=5)

    for trip in results:
        assert trip["total_cost"] <= 250


def test_find_destinations_within_budget_sorted():
    results = find_destinations_within_budget(budget=1000, days=5)

    prices = [trip["total_cost"] for trip in results]
    assert prices == sorted(prices)


def test_multi_country_distributes_remainder_days():
    # 6 dienos, 4 šalys -> base=1, remainder=2 -> dienos turi susumuoti į 6
    results = find_multi_country_trips(budget=100000, total_days=6, num_countries=4)

    assert len(results) > 0
    for trip in results:
        total_days_used = sum(d["days"] for d in trip["breakdown"])
        assert total_days_used == 6


def test_multi_country_empty_when_too_few_days():
    # Negalima 4 šalims skirti mažiau nei 4 dienų (bent 1 diena kiekvienai)
    results = find_multi_country_trips(budget=100000, total_days=3, num_countries=4)

    assert results == []