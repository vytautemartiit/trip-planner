import { cityCode, cityName } from './destinations'
import { DEFAULT_ORIGIN } from './origins'
import { locale, plural } from './i18n'

export const routeCodes = (trip) => `${trip.origin || DEFAULT_ORIGIN}${trip.stops.map((s) => ` → ${cityCode(s.destination)}`).join('')}`
export const tripTitle = (trip) => trip.stops.map((s) => cityName(s.destination)).join(' · ')

export const symbols ={ EUR: '€', USD: '$', GBP: '£', PLN: 'zł', CZK: 'Kč' }

export const CURRENCIES = Object.keys(symbols)

const SUFFIX_CURRENCIES = new Set(['PLN', 'CZK'])

// Whole units with thousands separators: "€1,250", "12 600 Kč"
export const formatMoney = (amount, currency = 'EUR') => {
  const symbol = symbols[currency] || currency
  const n = Math.round(Number(amount) || 0).toLocaleString(locale())
  return SUFFIX_CURRENCIES.has(currency) ? `${n} ${symbol}` : `${symbol}${n}`
}

export const formatPrice = (trip, currency) => {
  const value = currency === 'EUR' ? trip.total_cost : trip.total_cost_converted
  return value == null ? '—' : formatMoney(value, currency)
}

export { plural } from './i18n'

export const countries = (n) => plural(n, 'country', 'countries')

export const pad = (n) => String(n).padStart(3, '0')

// Trips from Vilnius keep their old keys, so tickets saved before origins existed still match.
const keyFor = (origin, route) => (!origin || origin === DEFAULT_ORIGIN ? route : `${origin}>${route}`)

// Single- and multi-country trips come back in different shapes; make them the same.
export const normalizeTrip = (trip) => {
  if (trip.breakdown) {
    return {
      key: keyFor(trip.origin, trip.countries.join('|')),
      multi: true,
      origin: trip.origin || DEFAULT_ORIGIN,
      stops: trip.breakdown,
      days: trip.total_days,
      total_cost: trip.total_cost,
      total_cost_converted: trip.total_cost_converted,
    }
  }
  return {
    key: keyFor(trip.origin, trip.destination),
    multi: false,
    origin: trip.origin || DEFAULT_ORIGIN,
    stops: [trip],
    days: trip.days,
    total_cost: trip.total_cost,
    total_cost_converted: trip.total_cost_converted,
  }
}

export const costTotals = (trip) =>
  trip.stops.reduce(
    (acc, s) => ({
      flight: acc.flight + s.flight_cost,
      hotel: acc.hotel + s.hotel_cost,
      living: acc.living + s.living_cost,
    }),
    { flight: 0, hotel: 0, living: 0 },
  )

export const ROUTE_COLORS = ['#1f2d2a', '#d0843f', '#3f7a72', '#b4432e', '#6d5a8c', '#3f6c8a']
