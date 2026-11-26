import Photo from './Photo'
import { ArrowRight, BedDouble, CalendarDays, MapPin, Plane, UtensilsCrossed } from 'lucide-react'
import { cityCode, cityName, countryName } from '../destinations'
import { countries, formatPrice, plural, tripTitle, routeCodes } from '../utils'
import { money } from '../rates'
import { tripRange } from '../chat'
import { tr } from '../i18n'

export function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'filled' : ''}>
      <path d="M6 3h12v18l-6-4-6 4z" />
    </svg>
  )
}

export default function TripCard({ trip, index, currency, saved, onToggleSave, onOpen }) {
  const [first, ...rest] = trip.stops
  const title = tripTitle(trip)
  const subtitle = trip.multi ? countries(trip.stops.length) : countryName(first.destination)

  return (
    <article
      className="card"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      // A click anywhere opens the trip; keyboard and screen readers use the title button
      onClick={onOpen}
    >
      <div className="card-photo">
        <Photo name={first.destination} index={index} />
        <div className="card-shade" />

        <span className="badge">
          <CalendarDays aria-hidden="true" /> {trip.startDate ? tripRange(trip) : plural(trip.days, 'day')}
        </span>

        <button
          type="button"
          className={`bookmark${saved ? ' saved' : ''}`}
          aria-pressed={saved}
          aria-label={saved ? tr('Remove from My tickets') : tr('Save to My tickets')}
          title={saved ? tr('Saved in My tickets') : tr('Save to My tickets')}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSave()
          }}
        >
          <BookmarkIcon filled={saved} />
        </button>

        {rest.length > 0 && (
          <div className="stop-thumbs">
            {rest.slice(0, 3).map((s, i) => (
              <span key={s.destination} className="stop-thumb" title={cityName(s.destination)}>
                <Photo name={s.destination} index={index + i + 1} />
              </span>
            ))}
            {rest.length > 3 && <span className="stop-thumb more">+{rest.length - 3}</span>}
          </div>
        )}

        <div className="card-caption">
          <span className="route">{routeCodes(trip)}</span>
          <h3 className={trip.multi ? 'multi' : ''}>
            <button
              type="button"
              className="card-open"
              aria-label={`${title}, ${formatPrice(trip, currency)}`}
              onClick={(e) => {
                e.stopPropagation()
                onOpen()
              }}
            >
              {title}
            </button>
          </h3>
          <span className="country">
              <MapPin aria-hidden="true" /> {subtitle}
            </span>
        </div>
        <span className="arrow" aria-hidden="true">
            <ArrowRight />
          </span>
      </div>

      <div className="card-body">
        <div className="price-block">
          <span className="price">{formatPrice(trip, currency)}</span>
          <span className="price-label">{tr("total")}</span>
        </div>
        <div className="breakdown">
          {trip.multi
            ? trip.stops.map((s) => (
                <span key={s.destination} className="mini-chip">
                  {cityCode(s.destination)} · {s.days}d · {money(s.total_cost, currency)}
                </span>
              ))
            : [
                <span key="f" className="mini-chip">
        <Plane aria-hidden="true" /> {money(first.flight_cost, currency)}</span>,
                <span key="h" className="mini-chip">
        <BedDouble aria-hidden="true" /> {money(first.hotel_cost, currency)}</span>,
                <span key="l" className="mini-chip">
        <UtensilsCrossed aria-hidden="true" /> {money(first.living_cost, currency)}</span>,
              ]}
        </div>
      </div>
    </article>
  )
}

export function SkeletonCard() {
  return (
    <div className="card skeleton" aria-hidden="true">
      <div className="card-photo shimmer" />
      <div className="card-body">
        <span className="shimmer line wide" />
        <span className="shimmer line" />
      </div>
    </div>
  )
}
