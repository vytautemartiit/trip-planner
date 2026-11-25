import { useEffect, useMemo, useState } from 'react'
import { Check, CircleCheck, CircleHelp, Info, Star, TriangleAlert } from 'lucide-react'
import Photo from './Photo'
import { CountrySelect } from './ProfileFields'
import { cityName, countryName } from '../destinations'
import { errorText, formatRange, stayDates, travelApi } from '../chat'
import { useCatalog } from '../hooks'
import { locale, tr } from '../i18n'

const TABS = [
  ['events', "What's on"],
  ['situation', 'Country situation'],
  ['documents', 'Documents'],
]

const LEVEL = {
  required: { icon: Check, label: 'Required' },
  recommended: { icon: Star, label: 'Recommended' },
  check: { icon: CircleHelp, label: 'Check' },
  warning: { icon: TriangleAlert, label: 'Warning' },
  info: { icon: Info, label: 'Good to know' },
}

function DocIcon({ level }) {
  const Icon = LEVEL[level].icon
  return <Icon />
}

const day = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })

const updated = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function Events({ stays, infos }) {
  return stays.map((s, i) => {
    const info = infos[i]
    return (
      <section key={i} className="info-stop">
        <header className="info-stop-head">
          <span className="info-thumb">
            <Photo name={s.destination} />
          </span>
          <div>
            <h3>{cityName(s.destination)}</h3>
            <span>{formatRange(s.start_date, s.end_date)}</span>
          </div>
        </header>
        {!info ? (
          <p className="muted">{tr("Loading…")}</p>
        ) : (
          <>
            {info.live_events === null ? null : info.live_events.length > 0 ? (
              <ul className="event-list">
                {info.live_events.map((e, j) => (
                  <li key={j}>
                    <span className="event-date">{e.date ? day(e.date) : ''}</span>
                    <span className="event-name">
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer">
                          {e.name}
                        </a>
                      ) : (
                        e.name
                      )}
                      <small>{[e.time?.slice(0, 5), e.venue, e.category].filter(Boolean).join(' · ')}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{tr("No concerts or shows listed for these dates yet.")}</p>
            )}

            {info.yearly_events.length > 0 && (
              <>
                <h4>{tr("Festivals during your stay")}</h4>
                <ul className="event-list">
                  {info.yearly_events.map((e) => (
                    <li key={e.name}>
                      <span className="event-date">{formatRange(e.start_date, e.end_date)}</span>
                      <span className="event-name">
                        {e.name}
                        <small>{tr("Held every year — exact dates can shift a little")}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {info.holidays.length > 0 && (
              <>
                <h4>{tr("Public holidays")}</h4>
                <ul className="event-list">
                  {info.holidays.map((h) => (
                    <li key={h.date + h.name}>
                      <span className="event-date">{day(h.date)}</span>
                      <span className="event-name">
                        {h.name}
                        <small>{h.local_name} · many shops and offices close</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {info.live_events !== null &&
              info.live_events.length === 0 &&
              info.yearly_events.length === 0 &&
              info.holidays.length === 0 && <p className="muted">{tr("Nothing special on — a calm time to visit.")}</p>}
            {info.live_events === null && info.yearly_events.length === 0 && info.holidays.length === 0 && (
              <p className="muted">{tr("No festivals or public holidays during your stay.")}</p>
            )}
            {info.errors?.map((e) => (
              <p key={e} className="muted small">
                <TriangleAlert aria-hidden="true" /> {e}
              </p>
            ))}
          </>
        )}
      </section>
    )
  })
}

function Situation({ stays, infos }) {
  // one block per country
  const seen = new Set()
  const blocks = stays
    .map((s, i) => ({ s, info: infos[i] }))
    .filter(({ s }) => {
      const c = countryName(s.destination)
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
  return blocks.map(({ s, info }) => (
    <section key={s.destination} className="info-stop">
      <header className="info-stop-head">
        <div>
          <h3>{countryName(s.destination)}</h3>
          {info?.advisory && <span>Updated {updated(info.advisory.updated_at)}</span>}
        </div>
      </header>
      {!info ? (
        <p className="muted">{tr("Loading…")}</p>
      ) : !info.advisory ? (
        <p className="muted">{tr("Travel advice couldn't be loaded right now. Try again later.")}</p>
      ) : (
        <>
          {info.advisory.alerts.length > 0 ? (
            <p className="alert-box">
              <TriangleAlert aria-hidden="true" /> Official warning: {info.advisory.alerts.join(', ').replaceAll('_', ' ')}</p>
          ) : (
            <p className="ok-box">
              <CircleCheck aria-hidden="true" /> No travel warnings against going to {countryName(s.destination)}.</p>
          )}
          {info.advisory.latest_change && (
            <p className="muted small">
              <strong>{tr("Latest update:")}</strong> {info.advisory.latest_change}
            </p>
          )}
          <dl className="advice">
            {info.advisory.safety.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.text}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small">
            Source:{' '}
            <a href={info.advisory.url} target="_blank" rel="noreferrer">
              {info.advisory.source}
            </a>{' '}
            — written for UK travellers, but the safety advice applies to everyone.
          </p>
        </>
      )}
    </section>
  ))
}

function Documents({ stays, homeCountry }) {
  const { catalog } = useCatalog()
  const [nationality, setNationality] = useState(homeCountry || '')
  const [docs, setDocs] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!nationality) return
    let alive = true
    travelApi
      .documents(nationality, stays[0].start_date, stays[stays.length - 1].end_date, stays.map((s) => s.destination))
      .then((d) => {
        if (!alive) return
        setDocs(d)
        setError('')
      })
      .catch((e) => alive && setError(errorText(e)))
    return () => {
      alive = false
    }
  }, [nationality, stays])

  return (
    <section className="info-stop">
      <div className="field">
        <label className="label" htmlFor="doc-nationality">
          {tr("Your passport is from")}
        </label>
        <CountrySelect id="doc-nationality" catalog={catalog} value={nationality} onChange={setNationality} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {!nationality && <p className="muted">{tr("Choose your passport country to see what you need.")}</p>}
      {nationality && docs?.nationality === nationality && (
        <>
          <p className="muted small">
            Trip of {docs.days} days to {[...new Set(stays.map((s) => countryName(s.destination)))].join(', ')} — all
            in the Schengen area.
          </p>
          <ul className="doc-list">
            {docs.items.map((item) => (
              <li key={item.title} className={`doc ${item.level}`}>
                <span className="doc-icon" aria-hidden="true">
                  <DocIcon level={item.level} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span className="doc-level">{tr(LEVEL[item.level].label)}</span>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">
            General guidance, not legal advice. Always confirm on the official sites:{' '}
            {docs.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && ' · '}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  )
}

export default function TripInfo({ ticket, user, onClose }) {
  const [tab, setTab] = useState('events')
  const stays = useMemo(() => stayDates(ticket), [ticket])
  const [infos, setInfos] = useState({})

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    let alive = true
    stays.forEach((s, i) =>
      travelApi
        .info(s.destination, s.start_date, s.end_date)
        .then((d) => alive && setInfos((prev) => ({ ...prev, [i]: d })))
        .catch((e) =>
          alive &&
          setInfos((prev) => ({
            ...prev,
            [i]: { live_events: [], yearly_events: [], holidays: [], advisory: null, errors: [errorText(e)] },
          })),
        ),
    )
    return () => {
      alive = false
    }
  }, [stays])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet info-sheet" role="dialog" aria-modal="true" aria-labelledby="info-title" onClick={(e) => e.stopPropagation()}>
        <header className="info-head">
          <div>
            <span className="eyebrow">{tr("Trip info")}</span>
            <h2 id="info-title">{stays.map((s) => cityName(s.destination)).join(' · ')}</h2>
            <span className="muted small">
              {formatRange(stays[0].start_date, stays[stays.length - 1].end_date)}
            </span>
          </div>
          <button type="button" className="icon-btn tiny" onClick={onClose} aria-label={tr("Close")}>
            ×
          </button>
        </header>

        <div className="tabs" role="tablist">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {tr(label)}
            </button>
          ))}
        </div>

        <div className="info-body">
          {tab === 'events' && <Events stays={stays} infos={infos} />}
          {tab === 'situation' && <Situation stays={stays} infos={infos} />}
          {tab === 'documents' && <Documents stays={stays} homeCountry={user?.home_country} />}
        </div>
      </div>
    </div>
  )
}
