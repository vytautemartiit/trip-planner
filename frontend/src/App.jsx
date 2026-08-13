import { useState } from 'react';
import './App.css';

// 1. Šalių ir miestų duomenys
const DESTINATIONS = [
  { id: 1, name: 'Barselona', code: 'BCN', flight_price: 120, hotel_per_night: 60, daily_cost: 40 },
  { id: 2, name: 'Roma', code: 'FCO', flight_price: 90, hotel_per_night: 50, daily_cost: 35 },
  { id: 3, name: 'Paryžius', code: 'CDG', flight_price: 150, hotel_per_night: 80, daily_cost: 50 },
  { id: 4, name: 'Varšuva', code: 'WAW', flight_price: 40, hotel_per_night: 30, daily_cost: 20 },
  { id: 5, name: 'Ryga', code: 'RIX', flight_price: 30, hotel_per_night: 35, daily_cost: 25 },
  { id: 6, name: 'Praha', code: 'PRG', flight_price: 80, hotel_per_night: 45, daily_cost: 30 },
];

const symbols = {
  EUR: '€',
  USD: '$',
  GBP: '£',
};

// 2. Skaičiuojama 1 šalies kaina
function calculateTripCost(destination, days) {
  const safeDays = Math.max(1, days);
  const nights = Math.max(0, safeDays - 1);
  const flightCost = destination.flight_price;
  const hotelCost = destination.hotel_per_night * nights;
  const livingCost = destination.daily_cost * safeDays;
  const totalCost = flightCost + hotelCost + livingCost;

  return {
    ...destination,
    days: safeDays,
    nights,
    flightCost,
    hotelCost,
    livingCost,
    totalCost,
  };
}

// 3. Kombinacijų generavimas
function getCombinations(arr, size) {
  if (size === 1) return arr.map((item) => [item]);
  const combinations = [];
  arr.forEach((item, index) => {
    const tailCombinations = getCombinations(arr.slice(index + 1), size - 1);
    tailCombinations.forEach((tail) => combinations.push([item, ...tail]));
  });
  return combinations;
}

// 4. Multi-city kelionių skaičiavimas
function findMultiCountryTrips(budget, totalDays, numCountries) {
  const daysPerCountry = Math.floor(totalDays / numCountries);
  if (daysPerCountry < 1 || numCountries < 1) return [];

  const combos = getCombinations(DESTINATIONS, numCountries);
  const results = [];

  combos.forEach((combo) => {
    let totalCost = 0;
    const breakdown = combo.map((dest) => {
      const trip = calculateTripCost(dest, daysPerCountry);
      totalCost += trip.totalCost;
      return trip;
    });

    if (totalCost <= budget) {
      results.push({
        id: combo.map((c) => c.code).join('-'),
        countries: breakdown.map((d) => d.name),
        codes: breakdown.map((d) => d.code),
        daysPerCountry,
        totalCost,
        breakdown,
      });
    }
  });

  return results.sort((a, b) => a.totalCost - b.totalCost);
}

function App() {
  const [currency, setCurrency] = useState('EUR');
  const [budget, setBudget] = useState('800');
  const [days, setDays] = useState('6');
  const [tripType, setTripType] = useState('single');
  const [numCountries, setNumCountries] = useState('2'); // Miestų skaičius kaip įvestis ranka

  const numericBudget = Number(budget) || 0;
  const numericDays = Number(days) || 1;
  const numericNumCountries = Math.min(Number(numCountries) || 2, DESTINATIONS.length); // Apribojame iki turimų miestų kiekio

  // Single trip rezultatai
  const singleTrips = DESTINATIONS
    .map((dest) => calculateTripCost(dest, numericDays))
    .filter((trip) => trip.totalCost <= numericBudget)
    .sort((a, b) => a.totalCost - b.totalCost);

  // Multi-city rezultatai
  const multiTrips = findMultiCountryTrips(numericBudget, numericDays, numericNumCountries);

  return (
    <div className="app">
      <header className="hero">
        <span className="eyebrow">Kelionių skaičiuoklė</span>
        <h1>Atostogų Planuoklis</h1>
        <p className="subtitle">Planuokite pavienes keliones arba kelių miestų maršrutus</p>
      </header>

      <section className="counter">
        <div className="field">
          <label>Tipas</label>
          <select 
            className="currency-select"
            value={tripType} 
            onChange={(e) => setTripType(e.target.value)}
          >
            <option value="single">1 Miestas</option>
            <option value="multi">Multi-City (Keli miestai)</option>
          </select>
        </div>

        {/* Miestų skaičiaus įvestis ranka */}
        {tripType === 'multi' && (
          <div className="field">
            <label>Miestų skaičius</label>
            <div className="input-row">
              <input
                type="number"
                min="2"
                max={DESTINATIONS.length}
                placeholder="2"
                value={numCountries}
                onChange={(e) => setNumCountries(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="field">
          <label>Valiuta</label>
          <select 
            className="currency-select"
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
          </select>
        </div>

        <div className="field">
          <label>Biudžetas</label>
          <div className="input-row">
            <span className="unit">{symbols[currency] || currency}</span>
            <input
              type="number"
              min="1"
              placeholder="500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Bendra trukmė</label>
          <div className="input-row">
            <input
              type="number"
              min="1"
              placeholder="6"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            <span className="unit">d.</span>
          </div>
        </div>
      </section>

      {/* Rezultatai */}
      <section className="results">
        {tripType === 'single' ? (
          singleTrips.length > 0 ? (
            singleTrips.map((trip) => (
              <div key={trip.id} className="ticket">
                <div className="ticket-top">
                  <div className="route">
                    <span className="plane">✈</span> VNO → {trip.code}
                  </div>
                  <span className="ticket-no">#TK-{100 + trip.id}</span>
                </div>

                <div className="destination">{trip.name}</div>
                <div className="days-label">{trip.days} d. ({trip.nights} naktys)</div>

                <div className="perforation">
                  <div className="hole hole-left"></div>
                  <div className="dashes"></div>
                  <div className="hole hole-right"></div>
                </div>

                <div className="ticket-bottom">
                  <div className="price-block">
                    <span className="price-label">Iš viso kaina</span>
                    <span className="price">
                      {trip.totalCost} {symbols[currency]}
                    </span>
                  </div>
                  <div className="breakdown">
                    <span>Skrydis: {trip.flightCost} {symbols[currency]}</span>
                    <span>Viešbučiai: {trip.hotelCost} {symbols[currency]}</span>
                    <span>Maistas/Išlaidos: {trip.livingCost} {symbols[currency]}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="empty">
              Už {numericBudget} {symbols[currency]} {numericDays} d. kelionei variantų nerasta.
            </p>
          )
        ) : (
          multiTrips.length > 0 ? (
            multiTrips.map((multi) => (
              <div key={multi.id} className="ticket">
                <div className="ticket-top">
                  <div className="route">
                    <span className="plane">✈</span> VNO → {multi.codes.join(' → ')}
                  </div>
                  <span className="ticket-no">#MULTI-{multi.codes.length}</span>
                </div>

                <div className="destination">{multi.countries.join(' + ')}</div>
                <div className="days-label">
                  {numericDays} d. bendrai (po {multi.daysPerCountry} d. kiekviename mieste)
                </div>

                <div className="perforation">
                  <div className="hole hole-left"></div>
                  <div className="dashes"></div>
                  <div className="hole hole-right"></div>
                </div>

                <div className="ticket-bottom">
                  <div className="price-block">
                    <span className="price-label">Bendra suminė kaina</span>
                    <span className="price">
                      {multi.totalCost} {symbols[currency]}
                    </span>
                  </div>
                  <div className="breakdown">
                    {multi.breakdown.map((item, idx) => (
                      <span key={idx}>
                        {item.name}: {item.totalCost} {symbols[currency]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="empty">
              Už {numericBudget} {symbols[currency]} nerasta {numericNumCountries} miestų kombinacijų {numericDays} d. laikotarpiui. Padidinkite biudžetą arba dienų skaičių.
            </p>
          )
        )}
      </section>
    </div>
  );
}

export default App;