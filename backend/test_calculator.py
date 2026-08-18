from calculator import calculate_trip_cost, find_destinations_within_budget

def test_calculate_trip_cost_basic():
    destination = {"name": "Testinis miestas", "flight_price": 50, "hotel_per_night": 30, "daily_cost": 20}
    result = calculate_trip_cost(destination, days=5)

    assert result["flight_cost"] == 50
    assert result["hotel_cost"] == 30 * 4  # 5 dienos = 4 naktys
    assert result["living_cost"] == 20 * 5
    assert result["total_cost"] == 50 + (30 * 4) + (20 * 5)


def test_calculate_trip_cost_single_day():
    destination = {"name": "Testinis miestas", "flight_price": 50, "hotel_per_night": 30, "daily_cost": 20}
    result = calculate_trip_cost(destination, days=1)

    assert result["hotel_cost"] == 0  # 1 diena = 0 nakvynių


def test_find_destinations_within_budget_filters_correctly():
    results = find_destinations_within_budget(budget=250, days=5)

    for trip in results:
        assert trip["total_cost"] <= 250


def test_find_destinations_within_budget_sorted():
    results = find_destinations_within_budget(budget=1000, days=5)

    prices = [trip["total_cost"] for trip in results]
    assert prices == sorted(prices)