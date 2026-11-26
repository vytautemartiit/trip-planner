import { useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, Info, Plane, ShieldCheck, Ticket } from 'lucide-react'
import DatePicker from './DatePicker'
import Photo from './Photo'
import RouteMap from './RouteMap'
import { countries, formatPrice, pad, plural, routeCodes, tripTitle, ROUTE_COLORS } from '../utils'
import { cityName } from '../destinations'
import { formatRange, stayDates, todayIso } from '../chat'
import { locale, tr } from '../i18n'

const savedOn = (ts) => {
  try {
    return new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function Tickets({
  tickets,
  onOpen,
  onRemove,
  onExplore,
  onImport,
  onSetDate,
  onToggleChat,
  onOpenChat,
  busyKey,
  user,
  onLogIn,
  verifiedKeys,
  onVerify,
  onInfo,
}) {
  const [hover, setHover] = useState(null)

  const routes = useMemo(
    () =>
      tickets.map((t, i) => ({
        key: t.key,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        label: `Ticket #${pad(i + 1)}`,
        origin: t.origin,
        stops: t.stops,
        currency: t.currency,
      })),
    [tickets],
  )

  const totalDays = tickets.reduce((s, t) => s + t.days, 0)

  if (tickets.length === 0) {
    return (
      <section className="tickets-page">
        <div className="tickets-empty">
          <span className="empty-icon" aria-hidden="true">
            <Ticket />
          </span>
          <h2>{tr("No saved tickets yet")}</h2>
          <p>
            {tr("Tap the bookmark on any trip and it will be kept here, together with its route on the map. Bought a ticket somewhere else? Add it here too.")}
          </p>
          <div className="empty-actions">
            <button type="button" className="primary small" onClick={onExplore}>
              {tr("Find a trip")}
            </button>
            <button type="button" className="ghost-btn" onClick={onImport}>
              {tr("+ Add a ticket I bought")}
            </button>
          </div>
          {!user && (
            <p className="login-hint">
              Have an account?{' '}
              <button type="button" className="link" onClick={onLogIn}>
                {tr("Log in")}
              </button>{' '}
              to see your saved tickets.
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="tickets-page">
      <div className="tickets-head">
        <div>
          <span className="eyebrow">{user ? `Synced to @${user.username}` : 'Saved on this device'}</span>
          <h2>{tr("My tickets")}</h2>
        </div>
        <div className="tickets-tools">
          <span className="tickets-stats">
            {plural(tickets.length, 'ticket')} · {plural(totalDays, 'day')} of travel
          </span>
          <button type="button" className="primary small" onClick={onImport}>
            {tr("+ Add a ticket")}
          </button>
        </div>
      </div>

      {!user && (
        <div className="sync-banner">
          <span>
            {tr("These tickets are only in this browser.")} <strong>{tr("Log in")}</strong> {tr("to keep them on all your devices.")}
          </span>
          <button type="button" className="ghost-btn" onClick={onLogIn}>
            {tr("Log in")}
          </button>
        </div>
      )}

      <div className="tickets-layout">
        <div className="tickets-map">
          <RouteMap
            routes={routes}
            highlight={hover}
            onStopClick={(key) => setHover(key)}
            className="big-map"
          />
          <p className="map-hint">{tr("Hover or tap a point on the map to see how many days each ticket stays there.")}</p>
        </div>

        <ul className="ticket-list">
          {tickets.map((t, i) => {
            const color = routes[i].color
            return (
              <li
                key={t.key}
                onMouseEnter={() => setHover(t.key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(t.key)}
                onBlur={() => setHover(null)}
              >
                <article className={`ticket${hover === t.key ? ' hot' : ''}`} style={{ '--c': color }}>
                  <div className="ticket-photo">
                    <Photo name={t.stops[0].destination} index={i} />
                  </div>

                  <div className="ticket-main">
                    <div className="ticket-top">
                      <span className="ticket-no">
                        <i className="ticket-color" /> TICKET #{pad(i + 1)}
                        {t.imported && <span className="imported-badge">{tr("Imported")}</span>}
                      </span>
                      <span className="ticket-date">{savedOn(t.savedAt)}</span>
                    </div>
                    <span className="ticket-route">{routeCodes(t)}</span>
                    <h3>{tripTitle(t)}</h3>
                    {t.imported && (t.booking?.airline || t.booking?.flight) && (
                      <span className="ticket-booking">
                        <Plane aria-hidden="true" /> {[t.booking.airline, t.booking.flight].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <div className="ticket-stops">
                      {(t.startDate ? stayDates(t) : t.stops).map((s, j) => (
                        <span key={j} className="mini-chip">
                          {j + 1}.{' '}
                          {s.start_date
                            ? `${cityName(s.destination)} ${formatRange(s.start_date, s.end_date)}`
                            : plural(s.days, 'day')}
                        </span>
                      ))}
                    </div>

                    <div className="ticket-share">
                      <div className="date-field">
                        <span>{tr("Departure")}</span>
                        <DatePicker
                          className="small"
                          min={todayIso()}
                          value={t.startDate || ''}
                          onChange={(iso) => onSetDate(t.key, iso)}
                          placeholder={tr("Pick a date")}
                          ariaLabel={tr("Departure date")}
                        />
                      </div>
                      <label
                        className={`switch${!t.startDate ? ' disabled' : ''}`}
                        title={t.startDate ? '' : 'Pick a departure date first'}
                      >
                        <input
                          type="checkbox"
                          role="switch"
                          checked={!!t.chat}
                          disabled={!t.startDate || busyKey === t.key}
                          onChange={() => onToggleChat(t)}
                        />
                        <span className="switch-track" aria-hidden="true">
                          <span className="switch-thumb" />
                        </span>
                        <span>{busyKey === t.key ? tr('Saving…') : tr('Meet travellers')}</span>
                      </label>
                    </div>
                    <div className="ticket-actions">
                      <button
                        type="button"
                        className="pill-btn"
                        onClick={() => onInfo(t)}
                        disabled={!t.startDate}
                        title={t.startDate ? '' : 'Pick a departure date first'}
                      >
                        <Info aria-hidden="true" /> {tr("Events, safety & documents")}
                      </button>
                      {verifiedKeys.has(t.key) ? (
                        <span className="verified-badge" title={tr("Ticket document checked for these cities and dates")}>
                          <BadgeCheck aria-hidden="true" /> {tr("Trip verified")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="pill-btn outline"
                          onClick={() => onVerify(t)}
                          disabled={!t.startDate}
                          title={t.startDate ? '' : 'Pick a departure date first'}
                        >
                          <ShieldCheck aria-hidden="true" /> {tr("Verify trip")}
                        </button>
                      )}
                    </div>
                    {!t.startDate && (
                      <p className="share-note">{tr("Pick your departure date to see events, safety advice and documents.")}</p>
                    )}
                    {t.chat && (
                      <p className="share-note">
                        Visible to travellers in the same countries on overlapping dates.{' '}
                        <button type="button" className="link" onClick={onOpenChat}>
                          {tr("Open chat")} <ArrowRight aria-hidden="true" />
                        </button>
                      </p>
                    )}
                  </div>

                  <div className="ticket-stub">
                    <span className="hole top" />
                    <span className="hole bottom" />
                    <span className="stub-label">{tr("Total")}</span>
                    <span className="stub-price">{formatPrice(t, t.currency)}</span>
                    <span className="stub-meta">
                      {plural(t.days, 'day')}
                      {t.multi ? ` · ${countries(t.stops.length)}` : ''}
                    </span>
                    <div className="stub-actions">
                      <button type="button" className="stub-btn" onClick={() => onOpen(t)}>
                        {tr("View")}
                      </button>
                      <button
                        type="button"
                        className="stub-btn ghost"
                        onClick={() => onRemove(t.key)}
                        aria-label={`Remove ticket ${pad(i + 1)}`}
                      >
                        {tr("Remove")}
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
