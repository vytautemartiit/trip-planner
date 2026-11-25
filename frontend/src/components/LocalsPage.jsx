import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, MessageCircle, SendHorizontal } from 'lucide-react'
import Dropdown from './Dropdown'
import Flag from './Flag'
import Photo from './Photo'
import ReportDialog from './ReportDialog'
import { LanguageList } from './ProfileFields'
import { CITIES, cityName } from '../destinations'
import { errorText, formatRange, formatTime, meetApi } from '../chat'
import { useCatalog } from '../hooks'
import { useFeedback } from '../feedback'
import { locale, tr } from '../i18n'

const REQUESTS_EVERY_MS = 10000
const MESSAGES_EVERY_MS = 3000

const STATUS = { pending: 'Waiting for an answer', accepted: 'Accepted', declined: 'Declined' }

const dayLabel = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })

// every day of the verified stays in one city
const daysIn = (stays) => {
  const out = []
  for (const s of stays) {
    const d = new Date(`${s.start_date}T00:00:00`)
    const end = new Date(`${s.end_date}T00:00:00`)
    for (; d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!out.includes(iso)) out.push(iso)
    }
  }
  return out
}

function AskForm({ token, local, city, days, onSent, onCancel }) {
  const [date, setDate] = useState(days[0])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ok = message.trim().length >= 10

  return (
    <form
      className="ask-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok || busy) return
        setBusy(true)
        try {
          await meetApi.ask(token, local.id, city, date, message.trim())
          onSent()
        } catch (err) {
          setError(errorText(err))
          setBusy(false)
        }
      }}
    >
      <div className="field">
        <span className="label">{tr("Which day?")}</span>
        <Dropdown
          className="box"
          value={date}
          onChange={setDate}
          ariaLabel={tr("Which day?")}
          options={days.map((d) => ({ value: d, label: dayLabel(d) }))}
        />
      </div>
      <label className="field">
        <span className="label">Say hi to {local.name}</span>
        <textarea
          rows={3}
          maxLength={500}
          placeholder={tr("Who you are, what you'd love to see, and roughly when you're free.")}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="ghost-btn" onClick={onCancel}>
          {tr("Cancel")}
        </button>
        <button type="submit" className="primary small" disabled={!ok || busy}>
          {busy ? tr('Sending…') : tr('Send request')}
        </button>
      </div>
    </form>
  )
}

function MeetThread({ token, request, onAuthLost }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const lastId = useRef(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    let alive = true
    const poll = () =>
      meetApi
        .messages(token, request.id, lastId.current)
        .then((d) => {
          if (!alive || !d.messages.length) return
          lastId.current = d.messages[d.messages.length - 1].id
          setMessages((prev) => [...prev, ...d.messages.filter((m) => !prev.some((p) => p.id === m.id))])
        })
        .catch((e) => alive && e.status === 401 && onAuthLost())
    poll()
    const id = setInterval(poll, MESSAGES_EVERY_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token, request.id, onAuthLost])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    try {
      const m = await meetApi.send(token, request.id, text)
      lastId.current = Math.max(lastId.current, m.id)
      setMessages((prev) => [...prev, m])
      setDraft('')
      setError('')
    } catch (e) {
      setError(errorText(e))
    }
  }

  return (
    <div className="meet-thread">
      <div className="messages small" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && <p className="messages-empty">{tr("Agree on a time and a public place to meet.")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`msg${m.mine ? ' mine' : ''}`}>
            <div className="bubble">
              {!m.mine && <span className="msg-name">{m.name}</span>}
              <p>{m.text}</p>
              <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
            </div>
          </div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          rows={1}
          maxLength={500}
          placeholder={tr("Message…")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          aria-label={tr("Message")}
        />
        <button type="submit" className="send" disabled={!draft.trim()} aria-label={tr("Send")}>
          <SendHorizontal />
        </button>
      </form>
      {error && <p className="form-error composer-error">{error}</p>}
    </div>
  )
}

function GuideForm({ token, user, guide, onSaved, onEditProfile }) {
  const homeCities = CITIES.filter((c) => c.iso === user.home_country)
  const [city, setCity] = useState(guide?.city || homeCities[0]?.destination || '')
  const [bio, setBio] = useState(guide?.bio || '')
  const [agreed, setAgreed] = useState(!!guide)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (homeCities.length === 0) {
    return (
      <p className="muted">
        None of our destinations are in your home country yet, so you can&apos;t guide visitors for now.{' '}
        <button type="button" className="link" onClick={onEditProfile}>
          {tr("Change your country")}
        </button>
      </p>
    )
  }

  const run = async (fn) => {
    setBusy(true)
    setError('')
    try {
      onSaved((await fn())?.guide ?? null)
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(false)
  }

  return (
    <form
      className="guide-form"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => meetApi.setGuide(token, city, bio.trim()))
      }}
    >
      <div className="field">
        <span className="label">{tr("Your city")}</span>
        <Dropdown
          className="box"
          value={city}
          onChange={setCity}
          ariaLabel={tr("Your city")}
          options={homeCities.map((c) => ({ value: c.destination, label: c.name }))}
        />
      </div>
      <label className="field">
        <span className="label">{tr("What would you like to show?")}</span>
        <textarea
          rows={3}
          maxLength={400}
          placeholder={tr("e.g. Coffee in my favourite courtyard and a walk through Vyšehrad. I'm free most evenings.")}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <span className="hint">{bio.trim().length}/400 · at least 20 characters</span>
      </label>
      {!guide && (
        <label className="consent">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            Verified travellers visiting {cityName(city)} may see my name, country, languages and this text, and send
            me requests to meet.
          </span>
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="dialog-actions">
        {guide && (
          <button type="button" className="ghost-btn" disabled={busy} onClick={() => run(() => meetApi.stopGuide(token))}>
            {tr("Stop showing people around")}
          </button>
        )}
        <button type="submit" className="primary small" disabled={busy || !agreed || bio.trim().length < 20}>
          {guide ? tr('Save') : tr('Offer to show people around')}
        </button>
      </div>
    </form>
  )
}

export default function LocalsPage({ token, user, verifiedStays, onGoTickets, onEditProfile, onAuthLost }) {
  const { confirm } = useFeedback()
  const [reporting, setReporting] = useState(null) // { id, name }
  const { catalog } = useCatalog()
  const [guide, setGuide] = useState(undefined) // undefined = loading, null = not a guide
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] })
  const [locals, setLocals] = useState({}) // city -> locals
  const [asking, setAsking] = useState(null) // `${city}|${localId}`
  const [openThread, setOpenThread] = useState(null)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const cities = [...new Set(verifiedStays.map((s) => s.destination))]
  const cityKey = cities.join('|')

  const fail = useCallback(
    (e) => {
      if (e.status === 401) onAuthLost()
      else setError(errorText(e))
    },
    [onAuthLost],
  )

  useEffect(() => {
    meetApi
      .myGuide(token)
      .then((d) => setGuide(d.guide))
      .catch(fail)
  }, [token, fail])

  useEffect(() => {
    let alive = true
    const load = () =>
      meetApi
        .requests(token)
        .then((d) => alive && setRequests(d))
        .catch((e) => alive && fail(e))
    load()
    const id = setInterval(load, REQUESTS_EVERY_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token, fail, refresh])

  useEffect(() => {
    let alive = true
    for (const city of cityKey ? cityKey.split('|') : []) {
      meetApi
        .locals(token, city)
        .then((d) => alive && setLocals((prev) => ({ ...prev, [city]: d.locals })))
        .catch((e) => alive && fail(e))
    }
    return () => {
      alive = false
    }
  }, [token, cityKey, fail, refresh])

  const act = async (fn) => {
    try {
      await fn()
      setRefresh((n) => n + 1)
    } catch (e) {
      fail(e)
    }
  }

  const person = (p) => (
    <span className="person-text">
      <strong>
        <Flag code={p.home_country} /> {p.name}
      </strong>
      <LanguageList codes={p.languages} catalog={catalog} />
    </span>
  )

  const allRequests = [...requests.incoming, ...requests.outgoing]

  return (
    <section className="locals-page">
      {error && <p className="form-error">{error}</p>}
      {reporting && (
        <ReportDialog
          token={token}
          person={reporting}
          where="meet"
          onCancel={() => setReporting(null)}
          onDone={() => {
            setReporting(null)
            setRefresh((n) => n + 1)
          }}
        />
      )}

      <div className="safety-box">
        <strong>{tr("Meet safely")}</strong> {tr("· Meet in busy public places, tell a friend where you're going, and never share your passport, booking code or address. Everyone you see here has verified a real trip or lives in the city.")}
      </div>

      <div className="locals-grid">
        <div className="locals-col">
          <h3>{tr("Locals where you're going")}</h3>
          {cities.length === 0 ? (
            <div className="locals-empty">
              <p>
                {tr("Verify a trip with your ticket to see locals who'd like to show you around. This keeps out people who aren't really travelling.")}
              </p>
              <button type="button" className="primary small" onClick={onGoTickets}>
                {tr("Go to My tickets")}
              </button>
            </div>
          ) : (
            cities.map((city) => {
              const stays = verifiedStays.filter((s) => s.destination === city)
              const list = locals[city]
              return (
                <div key={city} className="city-locals">
                  <header className="info-stop-head">
                    <span className="info-thumb">
                      <Photo name={city} />
                    </span>
                    <div>
                      <h4>{cityName(city)}</h4>
                      <span>
                        You: {stays.map((s) => formatRange(s.start_date, s.end_date)).join(', ')}
                      </span>
                    </div>
                  </header>
                  {!list && <p className="muted">{tr("Loading…")}</p>}
                  {list?.length === 0 && (
                    <p className="muted">No locals in {cityName(city)} have offered to show people around yet.</p>
                  )}
                  {list?.map((l) => {
                    const key = `${city}|${l.id}`
                    // live status from the polled requests (the locals list itself isn't polled)
                    const status = requests.outgoing.find(
                      (r) => r.local.id === l.id && r.city === city && ['pending', 'accepted'].includes(r.status),
                    )?.status
                    return (
                      <article key={l.id} className="local-card">
                        <div className="local-top">
                          <span className="avatar" aria-hidden="true">
                            {l.name.charAt(0).toUpperCase()}
                          </span>
                          {person(l)}
                          {status ? (
                            <span className={`status-pill ${status}`}>{STATUS[status]}</span>
                          ) : (
                            asking !== key && (
                              <button type="button" className="pill-btn" onClick={() => setAsking(key)}>
                                {tr("Ask to meet")}
                              </button>
                            )
                          )}
                        </div>
                        <p className="local-bio">“{l.bio}”</p>
                        <button
                          type="button"
                          className="link small danger report-link"
                          onClick={() => setReporting({ id: l.id, name: l.name })}
                        >
                          {tr("Report or block")}
                        </button>
                        {asking === key && (
                          <AskForm
                            token={token}
                            local={l}
                            city={city}
                            days={daysIn(stays)}
                            onCancel={() => setAsking(null)}
                            onSent={() => {
                              setAsking(null)
                              setRefresh((n) => n + 1)
                            }}
                          />
                        )}
                      </article>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="locals-col">
          <h3>{tr("Your meet-ups")}</h3>
          {allRequests.length === 0 && <p className="muted">{tr("Requests you send or receive will show up here.")}</p>}
          {allRequests.map((r) => {
            const other = r.role === 'local' ? r.traveller : r.local
            return (
              <article key={r.id} className={`meet-card ${r.status}`}>
                <div className="local-top">
                  <span className="avatar" aria-hidden="true">
                    {other.name.charAt(0).toUpperCase()}
                  </span>
                  {person(other)}
                  <span className={`status-pill ${r.status}`}>
                    {r.role === 'local' && r.status === 'pending' ? 'New request' : STATUS[r.status]}
                  </span>
                </div>
                <p className="meet-when">
                  {r.role === 'local' ? 'Wants to meet you' : 'You asked to meet'} in {cityName(r.city)} on{' '}
                  <strong>{dayLabel(r.date)}</strong>
                  {r.role === 'local' && (
                  <>
                    {' · '}
                    <BadgeCheck className="inline-icon" aria-hidden="true" /> {tr("verified traveller")}
                  </>
                )}
                </p>
                <p className="local-bio">“{r.message}”</p>
                <button
                  type="button"
                  className="link small danger report-link"
                  onClick={() => setReporting({ id: other.id, name: other.name })}
                >
                  Report or block {other.name}
                </button>
                <div className="meet-actions">
                  {r.role === 'local' && r.status === 'pending' && (
                    <>
                      <button type="button" className="primary small" onClick={() => act(() => meetApi.answer(token, r.id, true))}>
                        {tr("Accept")}
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => act(() => meetApi.answer(token, r.id, false))}>
                        {tr("Decline")}
                      </button>
                    </>
                  )}
                  {r.status === 'accepted' && (
                    <button
                      type="button"
                      className="pill-btn"
                      onClick={() => setOpenThread(openThread === r.id ? null : r.id)}
                    >
                      {openThread === r.id ? (
                    tr('Hide messages')
                  ) : (
                    <>
                      <MessageCircle aria-hidden="true" /> {tr("Messages")}
                    </>
                  )}
                    </button>
                  )}
                  {r.status !== 'declined' && (
                    <button
                      type="button"
                      className="link small danger"
                      onClick={async () => {
                        const yes = await confirm({
                          title: tr('Call off this meet-up?'),
                          text: tr('Your messages with each other will be deleted.'),
                          confirmLabel: tr('Call off'),
                          danger: true,
                        })
                        if (yes) act(() => meetApi.cancel(token, r.id))
                      }}
                    >
                      {r.status === 'pending' && r.role === 'traveller' ? tr('Withdraw') : tr('Call off')}
                    </button>
                  )}
                </div>
                {openThread === r.id && r.status === 'accepted' && (
                  <MeetThread token={token} request={r} onAuthLost={onAuthLost} />
                )}
              </article>
            )
          })}

          <h3 className="guide-title">{tr("Show visitors around your city")}</h3>
          {guide === undefined ? (
            <p className="muted">{tr("Loading…")}</p>
          ) : (
            <>
              {guide && (
                <p className="ok-box">
                  <BadgeCheck className="inline-icon" aria-hidden="true" /> You&apos;re listed as a local in {cityName(guide.city)}. Verified travellers can send you requests.
                </p>
              )}
              <GuideForm
                key={guide ? 'guide' : 'new'}
                token={token}
                user={user}
                guide={guide}
                onSaved={(g) => setGuide(g)}
                onEditProfile={onEditProfile}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
