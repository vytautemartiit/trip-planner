import { CITIES, findCity } from './destinations'
import { DEFAULT_ORIGIN, ORIGINS } from './origins'
import { CURRENCIES } from './utils'

// Links live after the "#", so they work on GitHub Pages without any server setup:
//   #/                       Explore (search settings in the query: #/?budget=500&days=5…)
//   #/tickets, #/chat        the other pages (also #/about, #/privacy, #/terms)
//   #/trip/VNO/PRG-3,BUD-2   one trip (from Vilnius: 3 days in Prague, then 2 in Budapest)

export const INFO_PAGES = ['about', 'privacy', 'terms']
export const VIEWS = ['explore', 'tickets', 'chat', ...INFO_PAGES]

export const viewPath = (view) => (view === 'explore' ? '#/' : `#/${view}`)

const codeOf = (destination) => findCity(destination)?.code

export const tripPath = (trip, currency) => {
  const stops = trip.stops.map((s) => `${codeOf(s.destination)}-${s.days}`).join(',')
  const q = new URLSearchParams()
  if (trip.startDate) q.set('date', trip.startDate)
  if (currency && currency !== 'EUR') q.set('cur', currency)
  const query = q.toString()
  return `#/trip/${trip.origin || DEFAULT_ORIGIN}/${stops}${query ? `?${query}` : ''}`
}

// Search settings <-> "#/?budget=…"
export const searchPath = (p) => {
  const q = new URLSearchParams({ budget: p.budget, days: p.days })
  if (p.countries > 1) q.set('countries', p.countries)
  if (p.origin && p.origin !== DEFAULT_ORIGIN) q.set('from', p.origin)
  if (p.startDate) q.set('date', p.startDate)
  if (p.currency && p.currency !== 'EUR') q.set('cur', p.currency)
  return `#/?${q}`
}

const isoDate = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '')
const int = (s, min, max) => {
  const n = Number(s)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

export const parseHash = (hash = window.location.hash) => {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  const currency = CURRENCIES.includes(q.get('cur')) ? q.get('cur') : 'EUR'

  if (parts[0] === 'trip' && parts[1] && parts[2]) {
    return {
      view: null,
      trip: { origin: parts[1].toUpperCase(), stops: parts[2], startDate: isoDate(q.get('date')), currency },
    }
  }

  const view = VIEWS.includes(parts[0]) ? parts[0] : 'explore'
  const budget = int(q.get('budget'), 1, 1_000_000)
  const days = int(q.get('days'), 1, 60)
  const search =
    view === 'explore' && budget && days
      ? {
          budget,
          days,
          countries: int(q.get('countries'), 1, CITIES.length) || 1,
          origin: ORIGINS.some((o) => o.code === q.get('from')) ? q.get('from') : null,
          startDate: isoDate(q.get('date')),
          currency,
        }
      : null
  return { view, search }
}
