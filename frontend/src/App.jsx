import { useState } from 'react'
import './App.css'

const getCode = (name) => {
  const clean = name.split(',')[0].trim().toUpperCase()
  return clean.slice(0, 3)
}

function App() {
  const [budget, setBudget] = useState('')
  const [days, setDays] = useState('')
  const [countries, setCountries] = useState(1)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const BASE_URL = 'https://orange-parakeet-4qqqgxq5x4pqhjp64-8000.app.github.dev'

  const handleSearch = async () => {
    if (!budget || !days) return
    setLoading(true)
    setSearched(true)
    try {
      const endpoint =
        countries === 1
          ? `${BASE_URL}/search?budget=${budget}&days=${days}`
          : `${BASE_URL}/search-multi?budget=${budget}&days=${days}&countries=${countries}`

      const response = await fetch(endpoint)
      const data = await response.json()
      setResults(data.results || [])
    } catch (err) {
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <header className="hero">
        <span className="eyebrow">Maršrutų skyrius · VNO</span>
        <h1>Kelionės Planuotojas</h1>
        <p className="subtitle">Įvesk biudžetą ir trukmę — gauk atspausdintus maršrutus.</p>
      </header>

      <div className="counter">
        <div className="field">
          <label>Biudžetas</label>
          <div className="input-row">
            <span className="unit">€</span>
            <input
              type="number"
              placeholder="500"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Trukmė</label>
          <div className="input-row">
            <input
              type="number"
              placeholder="5"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            <span className="unit">d.</span>
          </div>
        </div>
        <div className="field">
          <label>Šalių sk.</label>
          <div className="stepper">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                className={countries === n ? 'step active' : 'step'}
                onClick={() => setCountries(n)}
                type="button"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Ieškoma…' : 'Ieškoti →'}
        </button>
      </div>

      <div className="results">
        {searched && !loading && results.length === 0 && (
          <p className="empty">Nieko netelpa į šį biudžetą — pabandyk didesnę sumą arba trumpesnę kelionę.</p>
        )}

        {countries === 1
          ? results.map((trip, index) => (
              <div key={index} className="ticket">
                <div className="ticket-top">
                  <div className="route">
                    <span className="code">VNO</span>
                    <span className="plane">✈</span>
                    <span className="code">{getCode(trip.destination)}</span>
                  </div>
                  <span className="ticket-no">№ {String(index + 1).padStart(3, '0')}</span>
                </div>

                <div className="destination">{trip.destination}</div>
                <div className="days-label">{trip.days} dienos</div>

                <div className="perforation">
                  <span className="hole hole-left" />
                  <span className="dashes" />
                  <span className="hole hole-right" />
                </div>

                <div className="ticket-bottom">
                  <div className="price-block">
                    <span className="price-label">Iš viso</span>
                    <span className="price">{trip.total_cost}€</span>
                  </div>
                  <div className="breakdown">
                    <span>Skrydis {trip.flight_cost}€</span>
                    <span>Nakvynė {trip.hotel_cost}€</span>
                    <span>Pragyvenimas {trip.living_cost}€</span>
                  </div>
                </div>
              </div>
            ))
          : results.map((trip, index) => (
              <div key={index} className="ticket">
                <div className="ticket-top">
                  <div className="route">
                    <span className="code">VNO</span>
                    {trip.countries.map((c, i) => (
                      <span key={i}>
                        <span className="plane">✈</span>
                        <span className="code">{getCode(c)}</span>
                      </span>
                    ))}
                  </div>
                  <span className="ticket-no">№ {String(index + 1).padStart(3, '0')}</span>
                </div>

                <div className="destination">{trip.countries.join(' · ')}</div>
                <div className="days-label">{trip.days_per_country} d. kiekvienoje šalyje</div>

                <div className="perforation">
                  <span className="hole hole-left" />
                  <span className="dashes" />
                  <span className="hole hole-right" />
                </div>

                <div className="ticket-bottom">
                  <div className="price-block">
                    <span className="price-label">Iš viso</span>
                    <span className="price">{trip.total_cost}€</span>
                  </div>
                  <div className="breakdown">
                    {trip.breakdown.map((b, i) => (
                      <span key={i}>{getCode(b.destination)}: {b.total_cost}€</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}

export default App