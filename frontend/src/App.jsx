import { useState } from 'react'
import './App.css'

function App() {
  const [budget, setBudget] = useState('')
  const [days, setDays] = useState('')
  const [results, setResults] = useState([])

  const handleSearch = async () => {
    const response = await fetch(
      `https://orange-parakeet-4qqqgxq5x4pqhjp64-8000.app.github.dev/search?budget=${budget}&days=${days}`
    )
    const data = await response.json()
    setResults(data.results)
  }

  return (
    <div className="app">
      <h1>Kelionės Planuotojas</h1>

      <div className="search-form">
        <input
          type="number"
          placeholder="Biudžetas (EUR)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <input
          type="number"
          placeholder="Dienų skaičius"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <button onClick={handleSearch}>Ieškoti</button>
      </div>

      <div className="results">
        {results.map((trip, index) => (
          <div key={index} className="trip-card">
            <h3>{trip.destination}</h3>
            <p>Bendra kaina: {trip.total_cost}€</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App