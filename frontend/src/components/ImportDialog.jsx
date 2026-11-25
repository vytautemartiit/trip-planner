import { useEffect, useRef, useState } from 'react'
import { Ticket } from 'lucide-react'
import DatePicker from './DatePicker'
import Dropdown from './Dropdown'
import Flag from './Flag'
import Photo from './Photo'
import { CITIES } from '../destinations'
import { ORIGINS } from '../origins'
import { CURRENCIES, symbols } from '../utils'
import { todayIso } from '../chat'
import { tr } from '../i18n'

const MAX_STOPS = 6
const newRow = (i = 0) => ({ id: Math.random().toString(36).slice(2), city: CITIES[i % CITIES.length].destination, days: 3 })

// Add a ticket bought somewhere else (airline site, travel agency…) so it shows up on the map,
// gets photos and city info, and can be used in the chat like any other ticket.
export default function ImportDialog({ origin: defaultOrigin, onAdd, onCancel }) {
  const [rows, setRows] = useState(() => [newRow(3)])
  const [origin, setOrigin] = useState(defaultOrigin)
  const [startDate, setStartDate] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [airline, setAirline] = useState('')
  const [flight, setFlight] = useState('')
  const [reference, setReference] = useState('')
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const setRow = (id, fields) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...fields } : r)))

  const daysOk = rows.every((r) => Number.isInteger(r.days) && r.days >= 1 && r.days <= 60)
  const priceOk = price === '' || (Number(price) >= 0 && Number(price) <= 1_000_000)
  const valid = rows.length > 0 && daysOk && priceOk

  const submit = () => {
    const stops = rows.map((r) => ({ destination: r.city, days: r.days }))
    const paid = price === '' ? null : Math.round(Number(price) * 100) / 100
    onAdd({
      key: `import:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      imported: true,
      origin,
      multi: stops.length > 1,
      stops,
      days: stops.reduce((s, x) => s + x.days, 0),
      total_cost: currency === 'EUR' ? paid : null,
      total_cost_converted: paid,
      currency,
      startDate: startDate || undefined,
      booking: {
        airline: airline.trim() || undefined,
        flight: flight.trim().toUpperCase() || undefined,
        reference: reference.trim().toUpperCase() || undefined,
      },
      savedAt: Date.now(),
    })
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) submit()
        }}
      >
        <span className="dialog-icon" aria-hidden="true">
          <Ticket />
        </span>
        <h2 id="import-title">{tr("Add a ticket you bought")}</h2>
        <p>{tr("Bought a trip on an airline or travel site? Add it here to see it on the map and meet travellers there.")}</p>

        <div className="field">
          <span className="label">{tr("Flying from")}</span>
          <Dropdown
            className="pill"
            searchable
            value={origin}
            onChange={setOrigin}
            ariaLabel={tr("Flying from")}
            leading={<Flag code={ORIGINS.find((o) => o.code === origin)?.iso} />}
            options={ORIGINS.map((o) => ({ value: o.code, label: `${o.city} (${o.code})`, hint: o.country, icon: <Flag code={o.iso} /> }))}
          />
        </div>

        <fieldset className="import-stops">
          <legend className="label">{tr("Where are you going?")}</legend>
          {rows.map((r, i) => (
            <div key={r.id} className="import-row">
              <span className="import-thumb">
                <Photo name={r.city} />
              </span>
              <span className="import-no">{i + 1}</span>
              <Dropdown
                ref={i === 0 ? firstRef : undefined}
                className="bare grow"
                value={r.city}
                onChange={(city) => setRow(r.id, { city })}
                ariaLabel={`Stop ${i + 1} city`}
                options={CITIES.map((c) => ({ value: c.destination, label: c.name, hint: c.country }))}
              />
              <label className="import-days">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={Number.isNaN(r.days) ? '' : r.days}
                  onChange={(e) => setRow(r.id, { days: e.target.value === '' ? NaN : Number(e.target.value) })}
                  aria-label={`Days in stop ${i + 1}`}
                />
                <span>{tr("days")}</span>
              </label>
              {rows.length > 1 && (
                <button
                  type="button"
                  className="icon-btn tiny"
                  onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                  aria-label={`Remove stop ${i + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {!daysOk && <span className="hint error">{tr("Each stop needs 1–60 days.")}</span>}
          {rows.length < MAX_STOPS && (
            <button type="button" className="link" onClick={() => setRows((prev) => [...prev, newRow(prev.length)])}>
              {tr("+ Add another stop")}
            </button>
          )}
          <span className="hint">Only these {CITIES.length} cities are supported for now.</span>
        </fieldset>

        <div className="import-grid">
          <div className="field">
            <span className="label">{tr("Departure date")}</span>
            <DatePicker className="pill" min={todayIso()} value={startDate} onChange={setStartDate} placeholder={tr("optional")} ariaLabel={tr("Departure date")} />
          </div>

          <label className="field">
            <span className="label">{tr("Price paid")}</span>
            <div className="pill-input">
              <span className="unit">{symbols[currency]}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={tr("optional")}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <Dropdown
                className="bare"
                value={currency}
                onChange={setCurrency}
                ariaLabel={tr("Currency")}
                options={CURRENCIES.map((c) => ({ value: c, label: c, hint: symbols[c] }))}
              />
            </div>
          </label>

          <label className="field">
            <span className="label">{tr("Airline")}</span>
            <div className="pill-input">
              <input maxLength={40} placeholder={tr("optional")} value={airline} onChange={(e) => setAirline(e.target.value)} />
            </div>
          </label>

          <label className="field">
            <span className="label">{tr("Flight number")}</span>
            <div className="pill-input">
              <input maxLength={10} placeholder={tr("e.g. FR 2741")} value={flight} onChange={(e) => setFlight(e.target.value)} />
            </div>
          </label>

          <label className="field span-2">
            <span className="label">{tr("Booking reference")}</span>
            <div className="pill-input">
              <input
                maxLength={12}
                placeholder={tr("optional, e.g. X7K2PQ")}
                autoComplete="off"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <span className="hint">{tr("Flight details stay private — they are never shown in the chat.")}</span>
          </label>
        </div>

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {tr("Cancel")}
          </button>
          <button type="submit" className="primary small" disabled={!valid}>
            {tr("Add ticket")}
          </button>
        </div>
      </form>
    </div>
  )
}
