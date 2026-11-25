import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudOff, Plane, SearchX } from 'lucide-react'
import './App.css'
import TripCard, { SkeletonCard } from './components/TripCard'
import JoinDialog from './components/JoinDialog'
import AuthDialog from './components/AuthDialog'
import AccountMenu from './components/AccountMenu'
import CityCard from './components/CityCard'
import { useFeedback } from './feedback'
import { INFO_PAGES, parseHash, searchPath, tripPath, viewPath } from './routes'
import DatePicker from './components/DatePicker'
import Dropdown from './components/Dropdown'
import EmptyState from './components/EmptyState'
import Footer from './components/Footer'
import Flag from './components/Flag'
import LangSwitch from './components/LangSwitch'
import ThemeToggle from './components/ThemeToggle'
import { BASE_URL } from './api'
import { authApi, chatApi, errorText, loadSession, sameStays, stayDates, storeSession, todayIso, tripRange, verifyApi } from './chat'
import { DEFAULT_ORIGIN, ORIGINS, originForCountry, originFrom, originName, originOf } from './origins'
import { regionName } from './names'
import { CITIES, MAX_COUNTRIES, cityName } from './destinations'
import { CURRENCIES, countries as countriesLabel, formatMoney, normalizeTrip, plural, symbols, tripTitle } from './utils'
import { tr, useLang } from './i18n'

// Loaded when first needed, so the first screen comes up faster (the map library alone is big)
const TripDetail = lazy(() => import('./components/TripDetail'))
const Tickets = lazy(() => import('./components/Tickets'))
const ChatPage = lazy(() => import('./components/ChatPage'))
const ImportDialog = lazy(() => import('./components/ImportDialog'))
const ProfileDialog = lazy(() => import('./components/ProfileDialog'))
const TripInfo = lazy(() => import('./components/TripInfo'))
const VerifyDialog = lazy(() => import('./components/VerifyDialog'))
const InfoPage = lazy(() => import('./components/InfoPage'))

const PAGE_SIZE = 12
const TICKETS_KEY = 'trip-planner:tickets'
const ORIGIN_KEY = 'trip-planner:origin'

// What the address bar asked for when the page loaded (a page, a search or a shared trip)
const START = parseHash()

// The departure airport the user picked last time (null if they never picked one)
const storedOrigin = () => {
  try {
    const code = localStorage.getItem(ORIGIN_KEY)
    return ORIGINS.some((o) => o.code === code) ? code : null
  } catch {
    return null
  }
}

const storeOrigin = (code) => {
  try {
    localStorage.setItem(ORIGIN_KEY, code)
  } catch {
    /* storage blocked – the choice just won't be remembered */
  }
}

// Departure airport on load: from a bookmarked search, the last choice, or the home country
const START_ORIGIN =
  START.search?.origin || storedOrigin() || originForCountry(loadSession()?.user?.home_country) || DEFAULT_ORIGIN

// Built when shown, so the names follow the language
const originOptions = () =>
  ORIGINS.map((o) => ({
    value: o.code,
    label: `${originName(o)} (${o.code})`,
    hint: regionName(o.iso) || o.country,
    icon: <Flag code={o.iso} />,
  }))

// Saved tickets live in this browser's storage (and in the account when logged in).
const cleanTickets = (list) =>
  Array.isArray(list) ? list.filter((t) => t && t.key && Array.isArray(t.stops) && t.stops.length) : []

const loadTickets = () => {
  try {
    return cleanTickets(JSON.parse(localStorage.getItem(TICKETS_KEY) || '[]'))
  } catch {
    return []
  }
}

const storeTickets = (list) => {
  try {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(list))
  } catch {
    /* storage blocked (private mode etc.) – tickets just won't persist */
  }
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" className={`chip${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

function App() {
  useLang() // re-render everything when the language changes
  const { toast, confirm } = useFeedback()
  const [view, setViewState] = useState(START.view || 'explore')
  const exploreHash = useRef(START.search ? window.location.hash : '#/') // Explore's address, with the last search

  // Switch page and add it to the browser history, so Back works
  const setView = useCallback((v) => {
    setViewState(v)
    const path = v === 'explore' ? exploreHash.current : viewPath(v)
    if (window.location.hash !== path) window.history.pushState(null, '', path)
  }, [])

  const [budget, setBudget] = useState(START.search?.budget ?? 500)
  const [days, setDays] = useState(START.search?.days ?? 5)
  const [countries, setCountries] = useState(START.search?.countries ?? 1)
  const [currency, setCurrency] = useState(START.search?.currency ?? 'EUR')
  const [startDate, setStartDate] = useState(START.search?.startDate ?? '')
  const [origin, setOrigin] = useState(START_ORIGIN)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(!!START.search)
  const [searched, setSearched] = useState(!!START.search)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState(null) // parameters of the results currently shown
  const requestId = useRef(0)

  const [sort, setSort] = useState('cheap')
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [tickets, setTickets] = useState(loadTickets)
  const [open, setOpen] = useState(null) // { trip, currency }
  const [importing, setImporting] = useState(false)

  const savedKeys = useMemo(() => new Set(tickets.map((t) => t.key)), [tickets])

  // Ask the backend for trips. State is only touched once the answer arrives.
  const fetchResults = useCallback((p) => {
    const id = ++requestId.current
    const q = new URLSearchParams({ budget: p.budget, days: p.days, currency: p.currency, origin: p.origin })
    if (p.countries > 1) q.set('countries', p.countries)
    return fetch(`${BASE_URL}/${p.countries > 1 ? 'search-multi' : 'search'}?${q}`)
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText)
        return response.json()
      })
      .then((data) => {
        if (id !== requestId.current) return // a newer search has started; drop this answer
        setResults(
          (data.results || []).map(normalizeTrip).map((t) => (p.startDate ? { ...t, startDate: p.startDate } : t)),
        )
        setQuery({ ...p, cheapest: data.cheapest_total ?? null })
        setError(false)
        setLoading(false)
        // keep the search in the address bar so it can be bookmarked or shared
        exploreHash.current = searchPath(p)
        if (!window.location.hash.startsWith('#/trip')) window.history.replaceState(null, '', exploreHash.current)
      })
      .catch(() => {
        if (id !== requestId.current) return
        setResults([])
        setError(true)
        setLoading(false)
      })
  }, [])

  const runSearch = (overrides = {}) => {
    const p = { budget, days, countries, currency, origin, startDate, ...overrides }
    if (!p.budget || !p.days) return
    setLoading(true)
    setSearched(true)
    setError(false)
    setVisible(PAGE_SIZE)
    fetchResults(p)
  }

  // A bookmarked search in the address bar: show its results straight away
  useEffect(() => {
    if (START.search) fetchResults({ ...START.search, origin: START_ORIGIN })
  }, [fetchResults])

  // After the first search, changing countries or currency refreshes the results
  const changeCountries = (n) => {
    const next = Math.min(MAX_COUNTRIES, Math.max(1, n))
    const nextDays = Math.max(Number(days) || 0, next)
    setCountries(next)
    setDays(nextDays)
    if (searched) runSearch({ countries: next, days: nextDays })
  }

  const changeCurrency = (c) => {
    setCurrency(c)
    if (searched) runSearch({ currency: c })
  }

  const changeStartDate = (iso) => {
    setStartDate(iso)
    if (searched) runSearch({ startDate: iso })
  }

  const changeOrigin = (code) => {
    setOrigin(code)
    storeOrigin(code)
    if (searched) runSearch({ origin: code })
  }

  const updateTickets = useCallback((fn) => {
    setTickets((prev) => {
      const next = fn(prev)
      storeTickets(next)
      return next
    })
  }, [])

  const setTicketFields = useCallback(
    (key, fields) => updateTickets((prev) => prev.map((t) => (t.key === key ? { ...t, ...fields } : t))),
    [updateTickets],
  )


  // ---------- account: log in, sign up, ticket sync ----------
  const [session, setSession] = useState(loadSession) // { token, user }
  const token = session?.token
  const user = session?.user
  const [auth, setAuth] = useState(null) // open dialog: { mode, reason, then }
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [syncState, setSyncState] = useState('idle')
  const syncReady = useRef(false) // true once the account's tickets have been loaded here
  const [verified, setVerified] = useState({}) // ticket key -> stays proven with a ticket document

  const saveSession = useCallback((s) => {
    storeSession(s)
    setSession(s)
    // someone who never picked an airport flies from their home country by default
    const home = originForCountry(s?.user?.home_country)
    if (home && !storedOrigin()) setOrigin(home)
  }, [])

  const setUser = useCallback(
    (fields) =>
      setSession((prev) => {
        if (!prev) return prev
        const next = { ...prev, user: { ...prev.user, ...fields } }
        storeSession(next)
        return next
      }),
    [],
  )

  const endSession = useCallback(
    (clearTickets) => {
      syncReady.current = false
      saveSession(null)
      setSyncState('idle')
      setVerified({})
      updateTickets((prev) => (clearTickets ? [] : prev.map((t) => (t.chat ? { ...t, chat: false } : t))))
    },
    [saveSession, updateTickets],
  )

  // Token expired or the account was deleted elsewhere: keep the tickets here, stop the chat
  const authLost = useCallback(() => {
    endSession(false)
    toast('You were logged out. Log in again to sync tickets and use the chat.', { tone: 'info' })
  }, [endSession, toast])

  // Load the account's tickets. Right after logging in, tickets saved here while logged out
  // are added to the account; on later visits the account's list is the source of truth.
  const connect = useCallback(
    async (s, mergeLocal) => {
      try {
        const [me, saved, proofs] = await Promise.all([
          authApi.me(s.token),
          authApi.getTickets(s.token),
          verifyApi.list(s.token),
        ])
        saveSession({ token: s.token, user: me })
        const proven = Object.fromEntries(proofs.trips.map((t) => [t.ticket_key, t.stays]))
        setVerified(proven)
        let list = cleanTickets(saved.tickets)
        if (mergeLocal) {
          const byKey = new Map(list.map((t) => [t.key, t]))
          for (const t of loadTickets()) byKey.set(t.key, { ...byKey.get(t.key), ...t })
          list = [...byKey.values()]
        }
        // chat only stays on for tickets that are still verified for their current dates
        list = list.map((t) =>
          t.chat && !(me.chat_consent && sameStays(proven[t.key], stayDates(t))) ? { ...t, chat: false } : t,
        )
        syncReady.current = true
        updateTickets(() => list)
        setSyncState('saved')
        // re-share chat tickets in case the server was reset
        if (me.chat_consent) {
          await Promise.allSettled(
            list.filter((t) => t.chat && t.startDate).map((t) => chatApi.share(s.token, t.key, stayDates(t))),
          )
        }
      } catch (e) {
        if (e.status === 401) authLost()
        else setSyncState('error')
      }
    },
    [saveSession, updateTickets, authLost],
  )

  const started = useRef(false)
  useEffect(() => {
    if (started.current || !session) return
    started.current = true
    connect(session, false)
  }, [session, connect])

  // Every change to the tickets is saved to the account (debounced)
  useEffect(() => {
    if (!token || !syncReady.current) return
    const id = setTimeout(() => {
      authApi
        .putTickets(token, tickets)
        .then(() => setSyncState('saved'))
        .catch((e) => (e.status === 401 ? authLost() : setSyncState('error')))
    }, 700)
    return () => clearTimeout(id)
  }, [tickets, token, authLost])

  const openAuth = (mode = 'login', reason = '', then = null) => {
    setAuthError('')
    setAuth({ mode, reason, then })
  }

  const submitAuth = async ({ mode, username, password, displayName, homeCountry, languages, acceptTerms }) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      if (mode === 'delete') {
        await authApi.deleteAccount(token, password)
        endSession(true)
        setAuth(null)
        toast('Your account and everything in it was deleted.', { tone: 'success' })
      } else {
        const r =
          mode === 'signup'
            ? await authApi.register(username, password, displayName, homeCountry, languages, acceptTerms)
            : await authApi.login(username, password)
        const s = { token: r.token, user: r.user }
        started.current = true
        saveSession(s)
        const then = auth?.then
        setAuth(null)
        await connect(s, true)
        if (then) await then(s)
      }
    } catch (e) {
      setAuthError(errorText(e))
    }
    setAuthBusy(false)
  }

  const logOut = async () => {
    if (token) {
      // save the latest edits first, then end the session on the server
      if (syncReady.current) await authApi.putTickets(token, tickets).catch(() => {})
      await authApi.logout(token).catch(() => {})
    }
    endSession(true)
    toast('Logged out. Your tickets are kept in your account — log in to see them again.', { tone: 'info' })
  }

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileError, setProfileError] = useState('')
  const editProfile = () => {
    setProfileError('')
    setProfileOpen(true)
  }
  const closeProfile = useCallback(() => setProfileOpen(false), [])
  const saveProfile = async (fields) => {
    setProfileBusy(true)
    try {
      setUser(await authApi.updateProfile(token, fields))
      setProfileOpen(false)
    } catch (e) {
      if (e.status === 401) {
        setProfileOpen(false)
        authLost()
      }
      setProfileError(errorText(e))
    }
    setProfileBusy(false)
  }

  // ---------- trip info & verification ----------
  const [infoFor, setInfoFor] = useState(null) // ticket whose info is open
  const closeInfo = useCallback(() => setInfoFor(null), [])
  const [verifyFor, setVerifyFor] = useState(null) // { ticket, then }
  const [verifyBusy, setVerifyBusy] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const closeVerify = useCallback(() => setVerifyFor(null), [])

  const isVerified = (ticket) => !!ticket.startDate && sameStays(verified[ticket.key], stayDates(ticket))
  const verifiedKeys = new Set(tickets.filter(isVerified).map((t) => t.key))
  // future stays of verified tickets: used to find locals
  const verifiedStays = tickets
    .filter(isVerified)
    .flatMap((t) => stayDates(t))
    .filter((st) => st.end_date >= new Date().toISOString().slice(0, 10))

  const openVerify = (ticket, then = null, s = session) => {
    if (!s) {
      openAuth('login', 'Log in to verify your trip.', (ns) => openVerify(ticket, then, ns))
      return
    }
    setVerifyError('')
    setVerifyFor({ ticket, then })
  }

  const submitVerify = async (files) => {
    const { ticket, then } = verifyFor
    setVerifyBusy(true)
    setVerifyError('')
    try {
      const r = await verifyApi.verify(token, ticket.key, stayDates(ticket), files)
      setVerified((prev) => ({ ...prev, [ticket.key]: r.stays }))
      setVerifyFor(null)
      if (then) await then()
    } catch (e) {
      if (e.status === 401) {
        setVerifyFor(null)
        authLost()
      }
      setVerifyError(errorText(e))
    }
    setVerifyBusy(false)
  }

  // ---------- travel buddy chat ----------
  const [joinFor, setJoinFor] = useState(null) // ticket waiting for the opt-in dialog
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [chatBusy, setChatBusy] = useState(null) // key of the ticket being saved

  const shareTicket = async (ticket, withToken) => {
    setChatBusy(ticket.key)
    try {
      await chatApi.share(withToken, ticket.key, stayDates(ticket))
      setTicketFields(ticket.key, { chat: true })
    } catch (e) {
      if (e.status === 401) authLost()
      else toast(`Couldn't turn on Meet travellers: ${errorText(e)}`, { tone: 'error' })
    }
    setChatBusy(null)
  }

  // Turning the chat on needs an account, a verified trip and a one-time consent
  const startChatFor = async (ticket, s = session, justVerified = false) => {
    if (!s) {
      openAuth('login', 'Log in to meet other travellers. Your saved tickets will be kept in your account too.', (ns) =>
        startChatFor(ticket, ns),
      )
      return
    }
    if (!justVerified && !isVerified(ticket)) {
      openVerify(ticket, () => startChatFor(ticket, s, true), s)
      return
    }
    if (!s.user.chat_consent) {
      setJoinError('')
      setJoinFor(ticket)
      return
    }
    await shareTicket(ticket, s.token)
  }

  const toggleTicketChat = async (ticket) => {
    if (!ticket.chat) return startChatFor(ticket)
    setChatBusy(ticket.key)
    try {
      if (token) await chatApi.unshare(token, ticket.key)
      setTicketFields(ticket.key, { chat: false })
    } catch (e) {
      if (e.status === 401) authLost()
      else toast(`Couldn't turn off Meet travellers: ${errorText(e)}`, { tone: 'error' })
    }
    setChatBusy(null)
  }

  const joinChat = async (name) => {
    setJoinBusy(true)
    setJoinError('')
    try {
      if (name !== user.display_name) setUser(await authApi.rename(token, name))
      await chatApi.consent(token)
      setUser({ chat_consent: true })
      const ticket = joinFor
      setJoinFor(null)
      if (ticket) await shareTicket(ticket, token)
    } catch (e) {
      if (e.status === 401) {
        setJoinFor(null)
        authLost()
      }
      setJoinError(errorText(e))
    }
    setJoinBusy(false)
  }

  const setTicketDate = (key, startDate) => {
    const ticket = tickets.find((t) => t.key === key)
    if (!ticket) return
    setTicketFields(key, { startDate })
    // a verification only covers the dates on the ticket document
    if (ticket.chat && token) {
      toggleTicketChat(ticket)
      toast('You changed the dates, so Meet travellers was turned off. Verify the trip again to turn it back on.', { tone: 'info' })
    }
  }

  const leaveChat = async () => {
    if (!user) return
    const yes = await confirm({
      title: tr('Turn off the chat?'),
      text: tr('Chat will be turned off for all your tickets and all your messages will be deleted. This cannot be undone.'),
      confirmLabel: tr('Turn off and delete'),
      danger: true,
    })
    if (!yes) return
    try {
      await chatApi.withdraw(token)
    } catch (e) {
      if (e.status === 401) authLost()
      else toast(`Couldn't turn off the chat: ${errorText(e)}`, { tone: 'error' })
      return
    }
    setUser({ chat_consent: false })
    updateTickets((prev) => prev.map((t) => (t.chat ? { ...t, chat: false } : t)))
  }

  const sharedCount = user?.chat_consent ? tickets.filter((t) => t.chat).length : 0

  const removeTicket = useCallback(
    async (key) => {
      const ticket = tickets.find((t) => t.key === key)
      if (!ticket) return
      const linked = (ticket.chat || verified[key]) && token
      if (linked) {
        // the server side (chat visibility, verification) can't be undone, so ask first
        const yes = await confirm({
          title: tr('Remove this ticket?'),
          text: tr('It will also leave the travellers chat and lose its verification.'),
          confirmLabel: tr('Remove'),
          danger: true,
        })
        if (!yes) return
        if (ticket.chat) chatApi.unshare(token, key).catch(() => {})
        if (verified[key]) verifyApi.remove(token, key).catch(() => {})
      }
      updateTickets((prev) => prev.filter((t) => t.key !== key))
      toast(`${tripTitle(ticket)} removed from My tickets.`, {
        action: linked
          ? undefined
          : { label: tr('Undo'), onClick: () => updateTickets((prev) => (prev.some((t) => t.key === key) ? prev : [...prev, ticket])) },
      })
    },
    [tickets, token, verified, updateTickets, confirm, toast],
  )

  const toggleTicket = useCallback(
    (trip, tripCurrency) => {
      if (tickets.some((t) => t.key === trip.key)) return removeTicket(trip.key)
      updateTickets((prev) => [...prev, { ...trip, currency: tripCurrency, savedAt: Date.now() }])
      toast(`${tripTitle(trip)} saved to My tickets.`, {
        tone: 'success',
        action: { label: tr('View'), onClick: () => setView('tickets') },
      })
    },
    [tickets, removeTicket, updateTickets, toast, setView],
  )

  const addImported = (ticket) => {
    updateTickets((prev) => [...prev, ticket])
    setImporting(false)
    setView('tickets')
    toast(user ? tr('Ticket added and synced to your account.') : tr('Ticket added to My tickets.'), { tone: 'success' })
  }
  const closeImport = useCallback(() => setImporting(false), [])

  // ---------- trip details, with their own address ----------
  const lastOpen = useRef(null)

  const openTrip = useCallback((trip, tripCurrency) => {
    const o = { trip, currency: tripCurrency }
    lastOpen.current = o
    setOpen(o)
    window.history.pushState({ trip: true }, '', tripPath(trip, tripCurrency))
  }, [])

  const closeDetail = useCallback(() => {
    if (window.history.state?.trip) {
      window.history.back() // the popstate handler closes the sheet
    } else {
      // opened straight from a shared link: there's nothing to go back to
      setOpen(null)
      window.history.replaceState(null, '', viewPath(view === 'explore' ? 'explore' : view))
    }
  }, [view])

  const loadSharedTrip = useCallback(
    (link) => {
      const q = new URLSearchParams({ stops: link.stops, origin: link.origin, currency: link.currency })
      return fetch(`${BASE_URL}/trip?${q}`)
        .then((r) => {
          if (!r.ok) throw new Error(r.statusText)
          return r.json()
        })
        .then((data) => {
          const trip = normalizeTrip(data.trip)
          const o = { trip: link.startDate ? { ...trip, startDate: link.startDate } : trip, currency: link.currency }
          lastOpen.current = o
          setOpen(o)
        })
        .catch(() => {
          toast("That trip link doesn't work any more — but you can plan a new one here.", { tone: 'error' })
          window.history.replaceState(null, '', '#/')
        })
    },
    [toast],
  )

  // Back / Forward buttons, and links typed into the address bar
  useEffect(() => {
    const onPop = () => {
      const r = parseHash()
      if (r.trip) {
        const last = lastOpen.current
        if (last && tripPath(last.trip, last.currency) === window.location.hash) setOpen(last)
        else loadSharedTrip(r.trip)
        return
      }
      setOpen(null)
      setViewState(r.view)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [loadSharedTrip])

  // A shared trip link or a bookmarked search was opened
  useEffect(() => {
    if (START.trip) loadSharedTrip(START.trip)
  }, [loadSharedTrip])

  const shareTrip = async (trip, tripCurrency) => {
    const url = `${window.location.origin}${window.location.pathname}${tripPath(trip, tripCurrency)}`
    // phones get the system share sheet; computers get the link copied
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: `${tripTitle(trip)} · Trip Planner`, text: `${tripTitle(trip)} — ${plural(trip.days, 'day')}`, url })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied — paste it anywhere to share this trip.', { tone: 'success' })
    } catch {
      toast(`Copy this link to share the trip: ${url}`)
    }
  }

  // ---------- city info on the photo strip ----------
  const [cityInfo, setCityInfo] = useState(null) // { city, anchor: DOMRect | null }
  const [prices, setPrices] = useState({}) // backend name -> { flight_price, hotel_per_night, daily_cost }
  const hideTimer = useRef(null)
  const lastPointer = useRef('mouse')

  useEffect(() => {
    fetch(`${BASE_URL}/destinations?origin=${origin}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrices(Object.fromEntries(d.destinations.map((x) => [x.name, x]))))
      .catch(() => {})
  }, [origin])

  const showCity = (city, el, floating) => {
    clearTimeout(hideTimer.current)
    setCityInfo({ city, anchor: floating ? el.getBoundingClientRect() : null })
  }
  const keepCity = () => clearTimeout(hideTimer.current)
  const hideCitySoon = () => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setCityInfo((c) => (c?.anchor ? null : c)), 250)
  }
  const closeCity = useCallback(() => setCityInfo(null), [])
  const planFromCity = () => {
    setCityInfo(null)
    document.querySelector('.filter')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const shown = useMemo(
    () =>
      [...results].sort((a, b) => {
        if (sort === 'expensive') return b.total_cost - a.total_cost
        if (sort === 'days') return b.days - a.days || a.total_cost - b.total_cost
        return a.total_cost - b.total_cost
      }),
    [results, sort],
  )

  const cheapest = results.length ? Math.min(...results.map((t) => t.total_cost)) : 0
  const resultCurrency = query?.currency || currency

  return (
    <div className="app">
      {/* Hash routes own the URL fragment, so this moves focus instead of using href="#main" */}
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          const main = document.getElementById('main')
          main?.focus()
          main?.scrollIntoView()
        }}
      >
        {tr('Skip to content')}
      </button>
      <nav className="nav" aria-label={tr('Main')}>
        <button type="button" className="brand" onClick={() => setView('explore')}>
          <span className="brand-mark" aria-hidden="true"><Plane /></span> Trip Planner
        </button>
        <div className="nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'explore'}
            className={view === 'explore' ? 'active' : ''}
            onClick={() => setView('explore')}
          >
            {tr("Explore")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'tickets'}
            className={view === 'tickets' ? 'active' : ''}
            onClick={() => setView('tickets')}
          >
            <span className="tab-long">{tr("My tickets")}</span>
            <span className="tab-short">{tr("Tickets")}</span>
            <span key={tickets.length} className="count">
              {tickets.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'chat'}
            className={view === 'chat' ? 'active' : ''}
            onClick={() => setView('chat')}
          >
            {tr("Chat")}
          </button>
        </div>
        <LangSwitch />
        <ThemeToggle />
        <AccountMenu
          user={user}
          syncState={syncState}
          onLogIn={() => openAuth('login', tr('Log in to keep your tickets on every device and to chat with other travellers.'))}
          onLogOut={logOut}
          onRename={editProfile}
          onDelete={() => openAuth('delete')}
        />
      </nav>

      <main id="main" tabIndex={-1}>
      <Suspense fallback={<div className="page-loading" aria-busy="true" aria-label={tr('Loading…')} />}>
      {INFO_PAGES.includes(view) ? (
        <InfoPage page={view} onBack={() => setView('explore')} />
      ) : view === 'chat' ? (
        <ChatPage
          token={token}
          user={user}
          sharedCount={sharedCount}
          onGoTickets={() => setView('tickets')}
          onLogIn={() => openAuth('login', tr('Log in to chat with travellers who are in the same country at the same time.'))}
          onLeave={leaveChat}
          onRename={editProfile}
          verifiedStays={verifiedStays}
          onAuthLost={authLost}
        />
      ) : view === 'tickets' ? (
        <Tickets
          tickets={tickets}
          onOpen={(t) => openTrip(t, t.currency)}
          onRemove={removeTicket}
          onExplore={() => setView('explore')}
          onImport={() => setImporting(true)}
          onSetDate={setTicketDate}
          onToggleChat={toggleTicketChat}
          onOpenChat={() => setView('chat')}
          busyKey={chatBusy}
          verifiedKeys={verifiedKeys}
          onVerify={(t) => openVerify(t)}
          onInfo={setInfoFor}
          user={user}
          onLogIn={() => openAuth('login', tr('Log in to keep your tickets on every device.'))}
        />
      ) : (
        <>
          <header className="hero">
            <div className="hero-text">
              <span className="eyebrow">{tr('Top destinations from {city}', { city: originFrom(originOf(origin)) })}</span>
              <h1>{tr("Plan your next trip")}</h1>
              <p className="subtitle">{tr("Enter your budget and trip length, and we'll show you where you can go.")}</p>
            </div>
            <div className="hero-strip" onPointerLeave={hideCitySoon}>
              <div className={`strip-track${cityInfo ? ' paused' : ''}`}>
                {[...CITIES, ...CITIES].map((c, i) => {
                  const copy = i >= CITIES.length // second copy only makes the loop seamless
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`strip-item${cityInfo?.city === c ? ' active' : ''}`}
                      aria-hidden={copy || undefined}
                      tabIndex={copy ? -1 : undefined}
                      aria-label={copy ? undefined : tr('About {city}', { city: cityName(c.name) })}
                      onPointerDown={(e) => (lastPointer.current = e.pointerType)}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && showCity(c, e.currentTarget, true)}
                      onClick={(e) => {
                        if (lastPointer.current === 'mouse' && cityInfo?.city === c && cityInfo.anchor) return
                        showCity(c, e.currentTarget, false)
                      }}
                    >
                      <img src={c.src} alt="" loading="lazy" />
                      <span className="strip-caption">{cityName(c.name)}</span>
                    </button>
                  )
                })}
              </div>
              <span className="strip-hint">{tr("Hover or tap a city to learn more")}</span>
            </div>
          </header>

          <form
            className="filter"
            onSubmit={(e) => {
              e.preventDefault()
              runSearch()
            }}
          >
            <div className="filter-from">
              <label className="label" htmlFor="origin">
                {tr("Flying from")}
              </label>
              <Dropdown
                id="origin"
                className="pill"
                searchable
                value={origin}
                onChange={changeOrigin}
                ariaLabel={tr("Flying from")}
                leading={<Flag code={originOf(origin).iso} />}
                options={originOptions()}
              />
              <span className="label" id="leaving-label">
                {tr("Leaving on")}
              </span>
              <div className="filter-date">
                <DatePicker
                  className="pill"
                  min={todayIso()}
                  value={startDate}
                  onChange={changeStartDate}
                  placeholder={tr("Any date")}
                  ariaLabel={tr("Leaving on")}
                />
              </div>
              {origin !== DEFAULT_ORIGIN && (
                <span className="hint">
                  {tr('Flight prices from {city} are estimates based on distance.', { city: originFrom(originOf(origin)) })}
                </span>
              )}
            </div>

            <div className="filter-grid">
              <div className="field">
                <div className="field-head">
                  <label htmlFor="budget">{tr("Budget")}</label>
                  <span className="field-value">{formatMoney(budget || 0)}</span>
                </div>
                <input
                  type="range"
                  className="slider"
                  min="50"
                  max="3000"
                  step="10"
                  value={budget || 50}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  aria-label={tr("Budget slider")}
                />
                <div className="pill-input">
                  <span className="unit">€</span>
                  <input
                    id="budget"
                    type="number"
                    min="0"
                    placeholder="500"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="field">
                <div className="field-head">
                  <label htmlFor="days">{tr("Trip length")}</label>
                  <span className="field-value">{plural(Number(days) || 0, 'day')}</span>
                </div>
                <input
                  type="range"
                  className="slider"
                  min={countries}
                  max="30"
                  value={days || countries}
                  onChange={(e) => setDays(Number(e.target.value))}
                  aria-label={tr("Trip length slider")}
                />
                <div className="pill-input">
                  <input
                    id="days"
                    type="number"
                    min={countries}
                    placeholder="5"
                    value={days}
                    onChange={(e) => setDays(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                  <span className="unit">{tr("days")}</span>
                </div>
              </div>

              <div className="field">
                <div className="field-head">
                  <span className="label">{tr("Countries to visit")}</span>
                  <span className="field-value">{tr('up to {n}', { n: MAX_COUNTRIES })}</span>
                </div>
                <div className="stepper">
                  <button
                    type="button"
                    className="step"
                    onClick={() => changeCountries(countries - 1)}
                    disabled={countries <= 1}
                    aria-label={tr("Fewer countries")}
                  >
                    −
                  </button>
                  <span className="step-value" aria-live="polite">
                    <strong>{countries}</strong> {countriesLabel(countries).replace(/^\d+ /, '')}
                  </span>
                  <button
                    type="button"
                    className="step"
                    onClick={() => changeCountries(countries + 1)}
                    disabled={countries >= MAX_COUNTRIES}
                    aria-label={tr("More countries")}
                  >
                    +
                  </button>
                </div>
                <div className="dots" aria-hidden="true">
                  {Array.from({ length: MAX_COUNTRIES }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      tabIndex={-1}
                      className={`dot${i < countries ? ' on' : ''}`}
                      onClick={() => changeCountries(i + 1)}
                    />
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">{tr("Currency")}</span>
                <div className="chips">
                  {CURRENCIES.map((c) => (
                    <Chip key={c} active={currency === c} onClick={() => changeCurrency(c)}>
                      {c} {symbols[c]}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="primary" disabled={loading || !budget || !days}>
              {loading ? tr('Searching…') : tr('Find trips')}
            </button>
          </form>

          {searched && (
            <div className="results-head">
              <div>
                <h2>
                  {loading
                    ? tr('Searching…')
                    : results.length > 0
                      ? tr('{n} found', { n: plural(results.length, 'trip') })
                      : tr('Nothing found')}
                </h2>
                {!loading && results.length > 0 && query && (
                  <span className="results-sub">
                    {tr('from {price}', { price: formatMoney(cheapest) })} ·{' '}
                    {query.startDate
                      ? tripRange({ startDate: query.startDate, stops: [{ days: Number(query.days) }] })
                      : plural(Number(query.days), 'day')}{' '}
                    · {countriesLabel(query.countries)} · {tr('from {city}', { city: originFrom(originOf(query.origin)) })}
                  </span>
                )}
              </div>

              {!loading && results.length > 0 && (
                <div className="segmented" role="group" aria-label={tr("Sort by")}>
                  {[
                    ['cheap', tr('Cheapest')],
                    ['expensive', tr('Priciest')],
                    ['days', tr('Longest')],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={sort === key ? 'active' : ''}
                      aria-pressed={sort === key}
                      onClick={() => setSort(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="results">
            {loading && Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}

            {!loading && error && (
              <EmptyState
                tone="error"
                icon={CloudOff}
                title={tr("Can't reach the server")}
                text="Your connection may be down, or the server is waking up. Your search is kept — just try again."
              >
                <button type="button" className="primary small" onClick={() => runSearch()}>
                  {tr("Try again")}
                </button>
              </EmptyState>
            )}

            {!loading && !error && searched && results.length === 0 && query && (
              <EmptyState
                icon={SearchX}
                title={tr('Nothing fits {budget} for {days}', {
                  budget: formatMoney(query.budget),
                  days: plural(Number(query.days), 'day'),
                  n: query.days,
                })}
                text={
                  query.cheapest
                    ? tr(
                        query.countries > 1
                          ? 'The cheapest {n}-day trip to {countries} from {city} costs {price}.'
                          : 'The cheapest {n}-day trip from {city} costs {price}.',
                        {
                          n: query.days,
                          countries: countriesLabel(query.countries),
                          city: originFrom(originOf(query.origin)),
                          price: formatMoney(query.cheapest),
                        },
                      )
                    : tr('A trip to {countries} needs at least {days}.', {
                        countries: countriesLabel(query.countries),
                        days: plural(query.countries, 'day'),
                        n: query.countries,
                      })
                }
              >
                {query.cheapest && (
                  <button
                    type="button"
                    className="primary small"
                    onClick={() => {
                      const b = Math.ceil(query.cheapest / 10) * 10
                      setBudget(b)
                      runSearch({ budget: b })
                    }}
                  >
                    {tr('Search with {price}', { price: formatMoney(Math.ceil(query.cheapest / 10) * 10) })}
                  </button>
                )}
                {Number(query.days) > query.countries && (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      const d = Number(query.days) - 1
                      setDays(d)
                      runSearch({ days: d })
                    }}
                  >
                    {tr('Try {days}', { days: plural(Number(query.days) - 1, 'day') })}
                  </button>
                )}
                {query.countries > 1 && (
                  <button type="button" className="ghost-btn" onClick={() => changeCountries(query.countries - 1)}>
                    {tr("Visit fewer countries")}
                  </button>
                )}
              </EmptyState>
            )}

            {!loading &&
              shown.slice(0, visible).map((trip, index) => (
                <TripCard
                  key={trip.key}
                  trip={trip}
                  index={index}
                  currency={resultCurrency}
                  saved={savedKeys.has(trip.key)}
                  onToggleSave={() => toggleTicket(trip, resultCurrency)}
                  onOpen={() => openTrip(trip, resultCurrency)}
                />
              ))}
          </div>

          {!loading && shown.length > visible && (
            <button type="button" className="more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
              {tr('Show more ({n})', { n: shown.length - visible })}
            </button>
          )}
        </>
      )}
      </Suspense>

      </main>

      <Footer onGo={setView} />

      <Suspense fallback={null}>
      {joinFor && (
        <JoinDialog
          defaultName={user?.display_name}
          busy={joinBusy}
          error={joinError}
          onJoin={joinChat}
          onCancel={() => setJoinFor(null)}
        />
      )}

      {cityInfo && (
        <CityCard
          key={cityInfo.city.code}
          city={cityInfo.city}
          anchor={cityInfo.anchor}
          prices={prices[cityInfo.city.destination]}
          from={originOf(origin)}
          onClose={closeCity}
          onPlan={planFromCity}
          onPointerEnter={keepCity}
          onPointerLeave={hideCitySoon}
        />
      )}

      {profileOpen && user && (
        <ProfileDialog
          token={token}
          user={user}
          busy={profileBusy}
          error={profileError}
          onSave={saveProfile}
          onCancel={closeProfile}
        />
      )}

      {infoFor && <TripInfo ticket={infoFor} user={user} onClose={closeInfo} />}

      {verifyFor && (
        <VerifyDialog
          ticket={verifyFor.ticket}
          busy={verifyBusy}
          error={verifyError}
          onVerify={submitVerify}
          onCancel={closeVerify}
        />
      )}

      {importing && <ImportDialog origin={origin} onAdd={addImported} onCancel={closeImport} />}

      {auth && (
        <AuthDialog
          key={auth.mode}
          initialMode={auth.mode}
          reason={auth.reason}
          busy={authBusy}
          error={authError}
          onSubmit={submitAuth}
          onCancel={() => setAuth(null)}
        />
      )}

      {open && (
        <TripDetail
          trip={open.trip}
          currency={open.currency}
          saved={savedKeys.has(open.trip.key)}
          onToggleSave={() => toggleTicket(open.trip, open.currency)}
          onShare={() => shareTrip(open.trip, open.currency)}
          onClose={closeDetail}
        />
      )}
      </Suspense>
    </div>
  )
}

export default App
