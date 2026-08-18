from itertools import combinations
from data import destinations

def calculate_trip_cost(destination, days):
    """
    Apskaičiuoja bendrą vienos šalies/miesto kelionės kainą.
    destination - žodynas su flight_price, hotel_per_night, daily_cost
    days - kelionės trukmė dienomis
    """
    nights = days - 1  # jei keliauji 3 dienas, nakvoji 2 naktis
    
    flight_cost = destination["flight_price"]
    hotel_cost = destination["hotel_per_night"] * nights
    living_cost = destination["daily_cost"] * days
    
    total = flight_cost + hotel_cost + living_cost
    
    return {
        "destination": destination["name"],
        "days": days,
        "flight_cost": flight_cost,
        "hotel_cost": hotel_cost,
        "living_cost": living_cost,
        "total_cost": total
    }


def find_destinations_within_budget(budget, days):
    """
    Randa visas kelionės kryptis, kurios telpa į nurodytą biudžetą.
    budget - vartotojo bendras biudžetas (eurais)
    days - kelionės trukmė dienomis
    """
    results = []
    
    for destination in destinations:
        trip = calculate_trip_cost(destination, days)
        if trip["total_cost"] <= budget:
            results.append(trip)
    
    # Surikiuojame nuo pigiausio iki brangiausio
    results.sort(key=lambda x: x["total_cost"])
    
    return results

def find_multi_country_trips(budget, total_days, num_countries):
    """
    Randa kelių šalių kelionių kombinacijas, kurios telpa į biudžetą.
    budget - bendras biudžetas
    total_days - bendra kelionės trukmė dienomis
    num_countries - kiek šalių nori aplankyti (pvz., 2 arba 3)
    """
    days_per_country = total_days // num_countries  # dienos kiekvienai šaliai (po lygiai)
    
    results = []
    
    # Generuojame visas galimas šalių kombinacijas
    for combo in combinations(destinations, num_countries):
        total_cost = 0
        breakdown = []
        
        for destination in combo:
            trip = calculate_trip_cost(destination, days_per_country)
            total_cost += trip["total_cost"]
            breakdown.append(trip)
        
        if total_cost <= budget:
            results.append({
                "countries": [d["destination"] for d in breakdown],
                "days_per_country": days_per_country,
                "total_cost": total_cost,
                "breakdown": breakdown
            })
    
    results.sort(key=lambda x: x["total_cost"])
    
    return results