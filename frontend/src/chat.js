import { BASE_URL } from './api'
import { locale } from './i18n'

// ---------- what this browser remembers ----------

const SESSION_KEY = 'trip-planner:session'
const OLD_IDENTITY_KEY = 'trip-planner:chat-identity' // from the pre-accounts chat
const HIDDEN_KEY = 'trip-planner:chat-hidden'
const SEEN_KEY = 'trip-planner:chat-seen'

const read = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked – keep it in memory only */
  }
}

// { token, user: { id, username, display_name, chat_consent } }
export const loadSession = () => {
  write(OLD_IDENTITY_KEY, null)
  const v = read(SESSION_KEY, null)
  return v && v.token && v.user ? v : null
}
export const storeSession = (v) => write(SESSION_KEY, v)

export const loadHidden = () => new Set(read(HIDDEN_KEY, []))
export const storeHidden = (set) => write(HIDDEN_KEY, [...set])

export const loadSeen = () => read(SEEN_KEY, {})
export const storeSeen = (map) => write(SEEN_KEY, map)

// ---------- API ----------

async function call(path, { token, method = 'GET', body } = {}) {
  const headers = {}
  const isForm = body instanceof FormData
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
  if (!res.ok) {
    let detail = res.statusText || 'Request failed'
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* not JSON */
    }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json()
}

export const authApi = {
  register: (username, password, displayName, homeCountry, languages, acceptTerms) =>
    call('/auth/register', {
      method: 'POST',
      body: {
        username,
        password,
        display_name: displayName,
        home_country: homeCountry,
        languages,
        accept_terms: acceptTerms,
      },
    }),
  login: (username, password) => call('/auth/login', { method: 'POST', body: { username, password } }),
  logout: (token) => call('/auth/logout', { token, method: 'POST' }),
  me: (token) => call('/auth/me', { token }),
  rename: (token, displayName) => call('/auth/me', { token, method: 'PATCH', body: { display_name: displayName } }),
  updateProfile: (token, fields) => call('/auth/me', { token, method: 'PATCH', body: fields }),
  deleteAccount: (token, password) => call('/auth/delete-account', { token, method: 'POST', body: { password } }),
  getTickets: (token) => call('/account/tickets', { token }),
  putTickets: (token, tickets) => call('/account/tickets', { token, method: 'PUT', body: { tickets } }),
}

const room = (country) => `/chat/rooms/${encodeURIComponent(country)}/messages`

export const chatApi = {
  consent: (token) => call('/chat/consent', { token, method: 'POST' }),
  withdraw: (token) => call('/chat/consent', { token, method: 'DELETE' }),
  share: (token, ticketKey, stays) =>
    call('/chat/stays', { token, method: 'PUT', body: { ticket_key: ticketKey, stays } }),
  unshare: (token, ticketKey) =>
    call(`/chat/stays?ticket_key=${encodeURIComponent(ticketKey)}`, { token, method: 'DELETE' }),
  rooms: (token) => call('/chat/rooms', { token }),
  messages: (token, country, after = 0) => call(`${room(country)}?after=${after}`, { token }),
  send: (token, country, text) => call(room(country), { token, method: 'POST', body: { text } }),
}

const q = (params) => new URLSearchParams(params).toString()

export const travelApi = {
  info: (destination, start, end) =>
    call(`/travel/info?${q({ destination, start_date: start, end_date: end })}`),
  documents: (nationality, start, end, destinations) => {
    const params = new URLSearchParams({ nationality, start_date: start, end_date: end })
    destinations.forEach((d) => params.append('destinations', d))
    return call(`/travel/documents?${params}`)
  },
}

// Countries and languages people can pick (loaded once from the backend)
let catalog = null
export const loadCatalog = () => {
  if (!catalog) catalog = call('/travel/countries').catch((e) => ((catalog = null), Promise.reject(e)))
  return catalog
}

// "LT" -> 🇱🇹
export const flag = (code) =>
  code ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : ''

// Blocking and reporting people (see backend/safety.py)
export const safetyApi = {
  blocks: (token) => call('/safety/blocks', { token }),
  block: (token, userId) => call('/safety/blocks', { token, method: 'POST', body: { user_id: userId } }),
  unblock: (token, userId) => call(`/safety/blocks/${encodeURIComponent(userId)}`, { token, method: 'DELETE' }),
  report: (token, body) => call('/safety/reports', { token, method: 'POST', body }),
}

export const verifyApi = {
  verify: (token, ticketKey, stays, files) => {
    const form = new FormData()
    form.append('ticket_key', ticketKey)
    form.append('stays', JSON.stringify(stays))
    for (const f of files) form.append('files', f)
    return call('/trips/verify', { token, method: 'POST', body: form })
  },
  list: (token) => call('/trips/verified', { token }),
  remove: (token, ticketKey) =>
    call(`/trips/verified?ticket_key=${encodeURIComponent(ticketKey)}`, { token, method: 'DELETE' }),
}

export const meetApi = {
  myGuide: (token) => call('/locals/me', { token }),
  setGuide: (token, city, bio) => call('/locals/me', { token, method: 'PUT', body: { city, bio } }),
  stopGuide: (token) => call('/locals/me', { token, method: 'DELETE' }),
  locals: (token, city) => call(`/locals?${q({ city })}`, { token }),
  ask: (token, localId, city, date, message) =>
    call('/meet/requests', { token, method: 'POST', body: { local_id: localId, city, date, message } }),
  requests: (token) => call('/meet/requests', { token }),
  answer: (token, id, accept) => call(`/meet/requests/${id}/answer`, { token, method: 'POST', body: { accept } }),
  cancel: (token, id) => call(`/meet/requests/${id}/cancel`, { token, method: 'POST' }),
  messages: (token, id, after = 0) => call(`/meet/requests/${id}/messages?after=${after}`, { token }),
  send: (token, id, text) => call(`/meet/requests/${id}/messages`, { token, method: 'POST', body: { text } }),
}

// Same cities and dates? (a verification only counts for the exact trip it was made for)
export const sameStays = (a, b) =>
  !!a && !!b && a.length === b.length && a.every((s, i) => s.destination === b[i].destination &&
    s.start_date === b[i].start_date && s.end_date === b[i].end_date)

// Friendly text for a failed request (no status = the server could not be reached)
export const errorText = (e) => (e?.status ? e.message : "Can't reach the server. Check that the backend is running.")

// ---------- dates ----------

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayIso = () => toIso(new Date())

// Each stop follows the previous one: start date + the days spent at earlier stops.
export const stayDates = (ticket) => {
  if (!ticket.startDate) return []
  const cursor = fromIso(ticket.startDate)
  return ticket.stops.map((s) => {
    const start = new Date(cursor)
    const end = new Date(cursor)
    end.setDate(end.getDate() + s.days - 1)
    cursor.setDate(cursor.getDate() + s.days)
    return { destination: s.destination, start_date: toIso(start), end_date: toIso(end) }
  })
}

const short = (iso) => fromIso(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })

export const formatRange = (start, end) => (start === end ? short(start) : `${short(start)} – ${short(end)}`)

// "3 Jun – 7 Jun" for the whole trip, or '' when it has no date yet
export const tripRange = (trip) => {
  const d = stayDates(trip)
  return d.length ? formatRange(d[0].start_date, d[d.length - 1].end_date) : ''
}

export const formatTime = (isoDateTime) => {
  const d = new Date(isoDateTime)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
