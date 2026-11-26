import pytest

import currency

FAKE_RATES = {"USD": 1.1, "GBP": 0.85, "PLN": 4.3, "CZK": 25.0}


class FakeResponse:
    def __init__(self, rates):
        self._rates = rates

    def raise_for_status(self):
        pass

    def json(self):
        return {"rates": self._rates}


@pytest.fixture
def fake_rates(monkeypatch):
    """Exchange rates without the internet; counts how often the rate service is asked."""
    calls = []

    def fake_get(url, params, timeout):
        calls.append(params["symbols"])
        return FakeResponse({c: FAKE_RATES[c] for c in params["symbols"].split(",")})

    monkeypatch.setattr(currency.requests, "get", fake_get)
    monkeypatch.setattr(currency, "_rate_cache", {})
    return calls


def test_rates_endpoint(client, fake_rates):
    body = client.get("/rates").json()
    assert body == {"base": "EUR", "rates": {"EUR": 1.0, **FAKE_RATES}}
    client.get("/rates")
    assert len(fake_rates) == 1  # the second call comes from the cache


def test_rates_unavailable(client, monkeypatch):
    def broken(*args, **kwargs):
        raise ConnectionError("offline")

    monkeypatch.setattr(currency.requests, "get", broken)
    monkeypatch.setattr(currency, "_rate_cache", {})
    assert client.get("/rates").status_code == 503


def test_budget_is_read_in_the_chosen_currency(client, fake_rates):
    eur = client.get("/search", params={"budget": 400, "days": 5}).json()
    # 10,000 CZK at 25 CZK/EUR is the same €400 budget, so the same trips fit
    czk = client.get("/search", params={"budget": 10000, "days": 5, "currency": "CZK"}).json()
    assert [t["destination"] for t in czk["results"]] == [t["destination"] for t in eur["results"]]
    assert all(t["total_cost_converted"] == round(t["total_cost"] * 25, 2) for t in czk["results"])
    # while 400 CZK (€16) buys nothing
    assert client.get("/search", params={"budget": 400, "days": 5, "currency": "CZK"}).json()["count"] == 0


def test_cheapest_total_is_in_the_chosen_currency(client, fake_rates):
    eur = client.get("/search", params={"budget": 10, "days": 5}).json()["cheapest_total"]
    usd = client.get("/search", params={"budget": 10, "days": 5, "currency": "USD"}).json()["cheapest_total"]
    assert usd == round(eur * 1.1, 2)


def test_unknown_currency(client):
    assert client.get("/search", params={"budget": 500, "days": 5, "currency": "XYZ"}).status_code == 400
