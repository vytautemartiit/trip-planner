from fastapi import FastAPI
from calculator import find_destinations_within_budget, find_multi_country_trips
from currency import convert_amount

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Trip Planner API veikia!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/search")
def search_trips(budget: float, days: int, currency: str = "EUR"):
    results = find_destinations_within_budget(budget, days)
    
    for trip in results:
       trip["total_cost_converted"] = convert_amount(trip["total_cost"], currency)
    
    return {
        "budget": budget,
        "days": days,
        "currency": currency,
        "count": len(results),
        "results": results
    }


@app.get("/search-multi")
def search_multi_trips(budget: float, days: int, countries: int = 2, currency: str = "EUR"):
    results = find_multi_country_trips(budget, days, countries)
 
    for trip in results:
        trip["total_cost_converted"] = convert_amount(trip["total_cost"], currency)
 
    return {
        "budget": budget,
        "days": days,
        "countries": countries,
        "currency": currency,
        "count": len(results),
        "results": results
    }