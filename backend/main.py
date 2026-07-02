from fastapi import FastAPI
from calculator import find_destinations_within_budget, find_multi_country_trips

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Trip Planner API veikia!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/search")
def search_trips(budget: float, days: int):
    results = find_destinations_within_budget(budget, days)
    return {
        "budget": budget,
        "days": days,
        "count": len(results),
        "results": results
    }


@app.get("/search-multi")
def search_multi_trips(budget: float, days: int, countries: int = 2):
    results = find_multi_country_trips(budget, days, countries)
    return {
        "budget": budget,
        "days": days,
        "countries": countries,
        "count": len(results),
        "results": results
    }