import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, House, MessagesSquare, Plane, SendHorizontal } from 'lucide-react'
import Flag from './Flag'
import Photo from './Photo'
import LocalsPage from './LocalsPage'
import ReportDialog from './ReportDialog'
import { LanguageList } from './ProfileFields'
import { useCatalog } from '../hooks'
import { cityName, countryName } from '../destinations'
import { chatApi, formatRange, formatTime, loadHidden, loadSeen, storeHidden, storeSeen } from '../chat'
import { plural, ROUTE_COLORS } from '../utils'
import { tr } from '../i18n'

const ROOMS_EVERY_MS = 10000
const MESSAGES_EVERY_MS = 3000

const colorFor = (id) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return ROUTE_COLORS[h % ROUTE_COLORS.length]
}

function Avatar({ id, name }) {
  return (
    <span className="avatar" style={{ background: colorFor(id) }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

const stayText = (stays) => stays.map((s) => `${cityName(s.destination)} ${formatRange(s.start_date, s.end_date)}`).join(', ')

function Thread({ token, room, hidden, onHide, onUnhideAll, onBack, onSeen, onAuthLost }) {
  const [reporting, setReporting] = useState(null) // { id, name }
  const [messages, setMessages] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const { catalog } = useCatalog()
  const lastId = useRef(0)
  const scrollRef = useRef(null)
  const stickToBottom = useRef(true)

  const merge = useCallback((incoming) => {
    if (!incoming.length) return
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id))
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id))
      const fresh = incoming.filter((m) => !ids.has(m.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
  }, [])

  // Poll for new messages while this room is open
  useEffect(() => {
    let alive = true
    const poll = () =>
      chatApi
        .messages(token, room.country, lastId.current)
        .then((d) => {
          if (!alive) return
          merge(d.messages)
          setLoaded(true)
        })
        .catch((e) => {
          if (alive && e.status === 401) onAuthLost()
        })
    poll()
    const id = setInterval(poll, MESSAGES_EVERY_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token, room.country, merge, onAuthLost])

  useEffect(() => {
    if (messages.length) onSeen(room.country, messages[messages.length - 1].id)
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, room.country, onSeen])

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError('')
    try {
      const m = await chatApi.send(token, room.country, text)
      stickToBottom.current = true
      merge([m])
      setDraft('')
    } catch (e) {
      if (e.status === 401) onAuthLost()
      setSendError(e.message)
    }
    setSending(false)
  }

  const visible = messages.filter((m) => !hidden.has(m.traveller_id))
  const people = room.people.filter((p) => !hidden.has(p.traveller_id))
  const hiddenHere = room.people.length - people.length
  const country = countryName(room.my_stays[0].destination)

  return (
    <section className="thread" aria-label={`${country} chat`}>
      <header className="thread-head">
        <button type="button" className="icon-btn back" onClick={onBack} aria-label={tr("Back to chats")}>
          <ArrowLeft />
        </button>
        <span className="room-photo small">
          <Photo name={room.my_stays[0].destination} />
        </span>
        <div className="thread-title">
          <h3>{country}</h3>
          <span>You: {stayText(room.my_stays)}</span>
        </div>
      </header>

      <div className="people">
        {people.length === 0 ? (
          <span className="people-empty">
            No one else is in {country} on your dates yet. They&apos;ll appear here when they turn on Meet travellers.
          </span>
        ) : (
          people.map((p) => (
            <div key={p.traveller_id} className="person">
              <Avatar id={p.traveller_id} name={p.name} />
              <span className="person-text">
                <strong>
                  <Flag code={p.home_country} /> {p.name} {p.verified && <BadgeCheck className="verified-dot" aria-label={tr("Trip verified")} />}
                </strong>
                <span>{stayText(p.stays)}</span>
                <LanguageList codes={p.languages} catalog={catalog} />
              </span>
              <span className="person-actions">
                <button type="button" className="link small" onClick={() => onHide(p.traveller_id)}>
                  {tr("Hide")}
                </button>
                <button
                  type="button"
                  className="link small danger"
                  onClick={() => setReporting({ id: p.traveller_id, name: p.name })}
                >
                  {tr("Report")}
                </button>
              </span>
            </div>
          ))
        )}
        {hiddenHere > 0 && (
          <button type="button" className="link small" onClick={onUnhideAll}>
            {plural(hiddenHere, 'hidden person', 'hidden people')} · show
          </button>
        )}
      </div>

      <div
        className="messages"
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
        aria-live="polite"
      >
        {!loaded && <p className="messages-empty">{tr("Loading…")}</p>}
        {loaded && visible.length === 0 && (
          <p className="messages-empty">
            {tr("No messages yet. Say hello and suggest a plan — a walking tour, dinner, sharing a taxi from the airport.")}
          </p>
        )}
        {visible.map((m, i) => {
          const prev = visible[i - 1]
          const grouped = prev && prev.traveller_id === m.traveller_id
          return (
            <div key={m.id} className={`msg${m.mine ? ' mine' : ''}${grouped ? ' grouped' : ''}`}>
              {!m.mine && !grouped && <Avatar id={m.traveller_id} name={m.name} />}
              <div className="bubble">
                {!m.mine && !grouped && <span className="msg-name">{m.name}</span>}
                <p>{m.text}</p>
                <time dateTime={m.created_at}>{formatTime(m.created_at)}</time>
              </div>
            </div>
          )
        })}
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
          placeholder={`Message travellers in ${country}…`}
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
        <button type="submit" className="send" disabled={!draft.trim() || sending} aria-label={tr("Send")}>
          <SendHorizontal />
        </button>
      </form>
      {sendError && <p className="form-error composer-error">{sendError}</p>}
      {reporting && (
        <ReportDialog
          token={token}
          person={reporting}
          where="chat"
          onCancel={() => setReporting(null)}
          onDone={(blocked) => {
            if (blocked) onHide(reporting.id)
            setReporting(null)
          }}
        />
      )}
    </section>
  )
}

function TravellersChat({ token, user, sharedCount, onGoTickets, onLogIn, onLeave, onRename, onAuthLost }) {
  const [rooms, setRooms] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [hidden, setHidden] = useState(loadHidden)
  const [seen, setSeen] = useState(loadSeen)

  useEffect(() => {
    if (!token || !sharedCount) return
    let alive = true
    const load = () =>
      chatApi
        .rooms(token)
        .then((d) => {
          if (!alive) return
          setRooms(d.rooms)
          setError('')
        })
        .catch((e) => {
          if (!alive) return
          if (e.status === 401) onAuthLost()
          else setError("Can't reach the chat server. Check that the backend is running.")
        })
    load()
    const id = setInterval(load, ROOMS_EVERY_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [token, sharedCount, onAuthLost])

  useEffect(() => storeHidden(hidden), [hidden])
  useEffect(() => storeSeen(seen), [seen])

  const markSeen = useCallback(
    (country, id) => setSeen((prev) => ((prev[country] || 0) >= id ? prev : { ...prev, [country]: id })),
    [],
  )

  if (!user || sharedCount === 0) {
    return (
      <section className="chat-page">
        <div className="tickets-empty chat-intro">
          <span className="empty-icon" aria-hidden="true">
            <MessagesSquare />
          </span>
          <h2>{tr("Meet people travelling when you do")}</h2>
          <p>{tr("Chat with other travellers who will be in the same country at the same time — only if you both turn it on.")}</p>
          <ol className="steps">
            <li className={user ? 'done' : ''}>
              <strong>{tr("Log in")}</strong> {tr("or create a free account")}
            </li>
            <li>{tr("Save a trip to")} <strong>{tr("My tickets")}</strong></li>
            <li>{tr("Pick your")} <strong>{tr("departure date")}</strong></li>
            <li>
              <strong>{tr("Verify")}</strong> {tr("the trip with your ticket PDF")}
            </li>
            <li>{tr("Turn on")} <strong>{tr("Meet travellers")}</strong></li>
          </ol>
          {user ? (
            <button type="button" className="primary small" onClick={onGoTickets}>
              {tr("Go to My tickets")}
            </button>
          ) : (
            <button type="button" className="primary small" onClick={onLogIn}>
              {tr("Log in")}
            </button>
          )}
        </div>
      </section>
    )
  }

  const activeRoom = rooms?.find((r) => r.country === selected) || rooms?.[0] || null

  return (
    <section className="chat-page">
      <div className="tickets-head">
        <div>
          <span className="eyebrow">{tr("Travellers on your dates")}</span>
          <h2>{tr("Chat")}</h2>
        </div>
        <span className="tickets-stats">
          {tr("Chatting as")} <strong>{user.display_name}</strong> ·{' '}
          <button type="button" className="link" onClick={onRename}>
            {tr("Edit profile")}
          </button>
        </span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className={`chat-layout${selected ? ' open' : ''}`}>
        <aside className="room-list">
          {rooms === null && <p className="messages-empty">{tr("Loading chats…")}</p>}
          {rooms?.length === 0 && <p className="messages-empty">{tr("Your shared trips will show up here in a moment.")}</p>}
          {rooms?.map((r) => {
            const unread = r.last_message_id > (seen[r.country] || 0)
            const people = r.people.filter((p) => !hidden.has(p.traveller_id)).length
            return (
              <button
                key={r.country}
                type="button"
                className={`room${activeRoom?.country === r.country ? ' active' : ''}`}
                onClick={() => setSelected(r.country)}
              >
                <span className="room-photo">
                  <Photo name={r.my_stays[0].destination} />
                </span>
                <span className="room-text">
                  <strong>{countryName(r.my_stays[0].destination)}</strong>
                  <span>{formatRange(r.my_stays[0].start_date, r.my_stays[r.my_stays.length - 1].end_date)}</span>
                  <span className={people ? 'room-people' : 'room-people none'}>
                    {people ? plural(people, 'traveller') : 'No one yet'}
                  </span>
                </span>
                {unread && <span className="unread" aria-label={tr("New messages")} />}
              </button>
            )
          })}
          <div className="chat-settings">
            <p>{tr("Only travellers with overlapping dates can see you. Turn off Meet travellers on a ticket to stop sharing it.")}</p>
            <button type="button" className="link danger" onClick={onLeave}>
              {tr("Turn off chat and delete my messages")}
            </button>
          </div>
        </aside>

        {activeRoom ? (
          <Thread
            key={activeRoom.country}
            token={token}
            room={activeRoom}
            hidden={hidden}
            onHide={(id) => setHidden((prev) => new Set(prev).add(id))}
            onUnhideAll={() => setHidden(new Set())}
            onBack={() => setSelected(null)}
            onSeen={markSeen}
            onAuthLost={onAuthLost}
          />
        ) : (
          <section className="thread placeholder">
            <p className="messages-empty">{tr("Pick a chat on the left.")}</p>
          </section>
        )}
      </div>
    </section>
  )
}

export default function ChatPage(props) {
  const [mode, setMode] = useState('travellers')
  if (!props.user) return <TravellersChat {...props} />
  return (
    <>
      <div className="chat-switch segmented" role="tablist" aria-label={tr("Who to meet")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'travellers'}
          className={mode === 'travellers' ? 'active' : ''}
          onClick={() => setMode('travellers')}
        >
          <Plane aria-hidden="true" /> {tr("Travellers")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'locals'}
          className={mode === 'locals' ? 'active' : ''}
          onClick={() => setMode('locals')}
        >
          <House aria-hidden="true" /> {tr("Meet a local")}
        </button>
      </div>
      {mode === 'travellers' ? (
        <TravellersChat {...props} />
      ) : (
        <LocalsPage
          token={props.token}
          user={props.user}
          verifiedStays={props.verifiedStays}
          onGoTickets={props.onGoTickets}
          onEditProfile={props.onRename}
          onAuthLost={props.onAuthLost}
        />
      )}
    </>
  )
}
