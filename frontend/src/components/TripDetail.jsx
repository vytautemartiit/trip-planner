import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Share2, BedDouble, CalendarDays, Check, MapPin, Plane, UtensilsCrossed } from 'lucide-react'
import Photo from './Photo'
import RouteMap from './RouteMap'
import { BookmarkIcon } from './TripCard'
import { cityName, countryName, findCity } from '../destinations'
import { costTotals, formatPrice, plural } from '../utils'
import { money } from '../rates'
import { originOf } from '../origins'
import { formatRange, stayDates } from '../chat'
import { tr } from '../i18n'

const TABS = [
  ['map', 'Map'],
  ['route', 'Route'],
  ['costs', 'Costs'],
]
const IMPORTED_TABS = [
  ['map', 'Map'],
  ['route', 'Route'],
  ['booking', 'Booking'],
]

export default function TripDetail({ trip, currency, saved, onToggleSave, onShare, onClose }) {
  const [active, setActive] = useState(0)
  const [tab, setTab] = useState('map')
  const closeRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const routes = useMemo(
    () => [{ key: trip.key, color: '#1f2d2a', label: tr('This trip'), origin: trip.origin, stops: trip.stops, currency }],
    [trip, currency],
  )

  const stop = trip.stops[active]
  const dates = stayDates(trip)
  const photo = findCity(stop.destination)
  const totals = costTotals(trip)
  const sum = totals.flight + totals.hotel + totals.living || 1
  const parts = [
    { key: 'flight', label: tr('Flights'), icon: Plane, value: totals.flight },
    { key: 'hotel', label: tr('Accommodation'), icon: BedDouble, value: totals.hotel },
    { key: 'living', label: tr('Food & daily costs'), icon: UtensilsCrossed, value: totals.living },
  ]

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={cityName(stop.destination)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-photo">
          <Photo key={stop.destination} name={stop.destination} index={active} />
          <div className="card-shade" />
          <button ref={closeRef} type="button" className="icon-btn close" onClick={onClose} aria-label={tr("Close")}>
            <ArrowLeft />
          </button>
          <button
            type="button"
            className={`icon-btn save${saved ? ' saved' : ''}`}
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? tr('Remove from My tickets') : tr('Save to My tickets')}
          >
            <BookmarkIcon filled={saved} />
          </button>
          <button type="button" className="icon-btn share" onClick={onShare} aria-label={tr("Share this trip")}>
            <Share2 />
          </button>

          {trip.stops.length > 1 && (
            <div className="gallery">
              {trip.stops.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gallery-thumb${i === active ? ' active' : ''}`}
                  onClick={() => setActive(i)}
                  aria-label={cityName(s.destination)}
                >
                  <Photo name={s.destination} index={i} />
                </button>
              ))}
            </div>
          )}

          <div className="sheet-caption">
            <span className="badge static">
              <CalendarDays aria-hidden="true" />{' '}
              {dates[active] ? formatRange(dates[active].start_date, dates[active].end_date) : `${plural(stop.days, 'day')} here`}</span>
            <h2>{cityName(stop.destination)}</h2>
            <span className="country">
              <MapPin aria-hidden="true" /> {countryName(stop.destination)}</span>
          </div>
        </div>

        <div className="sheet-body">
          {photo && <p className="tagline">{photo.tagline}</p>}

          <div className="tabs" role="tablist">
            {(trip.imported ? IMPORTED_TABS : TABS).map(([key, label]) => (
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

          {tab === 'map' && (
            <div className="sheet-map-wrap">
              <RouteMap
                routes={routes}
                numbered
                activeIndex={active}
                onStopClick={(_, i) => setActive(i)}
                className="sheet-map"
              />
              <p className="map-hint">{tr("Hover or tap a point to see how many days you stay there.")}</p>
            </div>
          )}

          {tab === 'route' && (
            <ol className="timeline">
              <li className="tl-start">
                <span className="tl-dot" />
                <div>
                  <strong>{originOf(trip.origin).city}</strong>
                  <span>Departure · {originOf(trip.origin).code}</span>
                </div>
              </li>
              {trip.stops.map((s, i) => (
                <li key={i}>
                  <span className="tl-dot" />
                  <button
                    type="button"
                    className={`tl-stop${i === active ? ' active' : ''}`}
                    onClick={() => setActive(i)}
                  >
                    <span className="tl-thumb">
                      <Photo name={s.destination} index={i} />
                    </span>
                    <span className="tl-text">
                      <strong>{cityName(s.destination)}</strong>
                      <span>
                        {plural(s.days, 'day')} · {countryName(s.destination)}
                      </span>
                    </span>
                    {s.total_cost != null && <span className="tl-cost">{money(s.total_cost, currency)}</span>}
                  </button>
                </li>
              ))}
            </ol>
          )}

          {tab === 'booking' && (
            <dl className="booking">
              <div>
                <dt>{tr("Price paid")}</dt>
                <dd>{formatPrice(trip, currency)}</dd>
              </div>
              <div>
                <dt>{tr("Airline")}</dt>
                <dd>{trip.booking?.airline || '—'}</dd>
              </div>
              <div>
                <dt>{tr("Flight")}</dt>
                <dd>{trip.booking?.flight || '—'}</dd>
              </div>
              <div>
                <dt>{tr("Booking reference")}</dt>
                <dd className="mono">{trip.booking?.reference || '—'}</dd>
              </div>
              <p className="booking-note">{tr("Bought outside Trip Planner · these details are only visible to you.")}</p>
            </dl>
          )}

          {tab === 'costs' && (
            <div className="costs">
              <div className="bar">
                {parts.map((p) => (
                  <span
                    key={p.key}
                    className={`bar-part ${p.key}`}
                    style={{ width: `${(p.value / sum) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="legend">
                {parts.map((p) => (
                  <li key={p.key}>
                    <span className={`swatch ${p.key}`} />
                    <span>
                      <p.icon aria-hidden="true" /> {p.label}
                    </span>
                    <span className="legend-pct">{Math.round((p.value / sum) * 100)}%</span>
                    <strong>{money(p.value, currency)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {photo && (
            <p className="credit">
              Photo:{' '}
              <a href={photo.page} target="_blank" rel="noreferrer">
                {photo.author}
              </a>{' '}
              · {photo.license}
            </p>
          )}
        </div>

        <div className="sheet-footer">
          <div className="price-block">
            <span className="price">{formatPrice(trip, currency)}</span>
            <span className="price-label">
              {plural(trip.days, 'day')} {trip.imported ? '· price paid' : 'total'}
            </span>
          </div>
          <button type="button" className="primary small" onClick={onToggleSave}>
            {saved ? (
              <>
                <Check aria-hidden="true" /> {tr("In My tickets")}
              </>
            ) : (
              tr('Save ticket')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
