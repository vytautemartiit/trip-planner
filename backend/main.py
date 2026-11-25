from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from calculator import calculate_trip_cost, find_destinations_within_budget, find_multi_country_trips
from data import destinations
from currency import convert_amount
from db import init_db
from origins import DEFAULT_ORIGIN, ORIGINS, available_destinations, clean_origin, flight_price, origin_list
from auth import router as auth_router
from chat import router as chat_router
from meet import router as meet_router
from safety import router as safety_router
from travel import router as travel_router
from verify import router as verify_router

init_db()

app = FastAPI()
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(verify_router)
app.include_router(travel_router)
app.include_router(meet_router)
app.include_router(safety_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Trip Planner API veikia!"}

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/destinations")
def list_destinations(origin: str = "VNO"):
    """Visos kryptys su kainomis – rodomos miestų kortelėse. Skrydžio kaina – iš pasirinkto oro uosto."""
    origin = _origin(origin)
    return {
        "origin": origin,
        "destinations": [
            {**d, "flight_price": flight_price(d, origin), "flight_estimated": origin != DEFAULT_ORIGIN}
            for d in available_destinations(origin)
        ],
    }

def _origin(code):
    try:
        return clean_origin(code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/origins")
def list_origins():
    """Airports you can fly from. Prices are exact from Vilnius and estimated from the others."""
    return {"origins": origin_list()}


@app.get("/trip")
def get_trip(stops: str, currency: str = "EUR", origin: str = "VNO"):
    """
    One trip rebuilt from a shared link. stops = "PRG-3,BUD-2" (airport code - days, in order).
    Returns the same shape as /search (one stop) or /search-multi (several stops).
    """
    origin = _origin(origin)
    by_code = {code: o["destination"] for code, o in ORIGINS.items() if "destination" in o}
    by_name = {d["name"]: d for d in destinations}
    parts = [p for p in stops.split(",") if p]
    if not 1 <= len(parts) <= len(destinations):
        raise HTTPException(status_code=400, detail="A trip needs 1 to 8 stops")
    plan = []
    for part in parts:
        code, _, days = part.strip().upper().partition("-")
        if code not in by_code or not days.isdigit() or not 1 <= int(days) <= 60:
            raise HTTPException(status_code=400, detail=f"Unknown stop: {part}")
        plan.append((by_name[by_code[code]], int(days)))
    names = [d["name"] for d, _ in plan]
    if len(set(names)) != len(names) or ORIGINS[origin].get("destination") in names:
        raise HTTPException(status_code=400, detail="Each city can be visited once, and not the one you fly from")

    breakdown = [calculate_trip_cost(d, days, origin) for d, days in plan]
    total = sum(t["total_cost"] for t in breakdown)
    if len(breakdown) == 1:
        trip = breakdown[0]
    else:
        trip = {"countries": names, "total_days": sum(t["days"] for t in breakdown), "total_cost": total,
                "origin": origin, "breakdown": breakdown}
    trip["total_cost_converted"] = convert_amount(total, currency)
    return {"currency": currency, "trip": trip}


@app.get("/search")
def search_trips(budget: float, days: int, currency: str = "EUR", origin: str = "VNO"):
    origin = _origin(origin)
    results = find_destinations_within_budget(budget, days, origin)
    # nothing fits: tell the user what the cheapest trip would cost
    cheapest = None if results else next(iter(find_destinations_within_budget(float("inf"), days, origin)), None)
    
    for trip in results:
       trip["total_cost_converted"] = convert_amount(trip["total_cost"], currency)
    
    return {
        "budget": budget,
        "days": days,
        "currency": currency,
        "origin": origin,
        "count": len(results),
        "cheapest_total": cheapest["total_cost"] if cheapest else None,
        "results": results
    }


@app.get("/search-multi")
def search_multi_trips(budget: float, days: int, countries: int = 2, currency: str = "EUR", origin: str = "VNO"):
    origin = _origin(origin)
    results = find_multi_country_trips(budget, days, countries, origin)
    cheapest = None if results else next(iter(find_multi_country_trips(float("inf"), days, countries, origin)), None)
 
    for trip in results:
        trip["total_cost_converted"] = convert_amount(trip["total_cost"], currency)
 
    return {
        "budget": budget,
        "days": days,
        "countries": countries,
        "currency": currency,
        "origin": origin,
        "count": len(results),
        "cheapest_total": cheapest["total_cost"] if cheapest else None,
        "results": results
    }