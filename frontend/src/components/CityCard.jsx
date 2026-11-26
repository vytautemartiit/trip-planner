import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Banknote, Languages, MapPin, Plane, Sun } from 'lucide-react'
import { cityName, commonsPage, countryName, photoAt } from '../destinations'
import { money } from '../rates'
import { DEFAULT_ORIGIN, flightTime, originFrom, originOf } from '../origins'
import { tr } from '../i18n'

const GAP = 10
const EDGE = 12

// Put the floating card below the hovered photo, or above it, or wherever it fits on screen
const placeNear = (el, rect) => {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const w = el.offsetWidth
  const h = el.offsetHeight
  const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - w / 2), vw - w - EDGE)
  let top
  if (rect.bottom + GAP + h <= vh - EDGE) top = rect.bottom + GAP
  else if (rect.top - GAP - h >= EDGE) top = rect.top - GAP - h
  else top = Math.max(EDGE, vh - h - EDGE)
  el.style.left = `${left}px`
  el.style.top = `${top}px`
}

// A small info card for one destination: photos, a short intro, facts and typical prices.
// `anchor` = the hovered photo's rectangle (floating card); without it the card opens as a dialog (touch screens).
export default function CityCard({ city, anchor, prices, currency = 'EUR', from = originOf(), onClose, onPlan, onPointerEnter, onPointerLeave }) {
  const photos = [{ src: city.src, caption: cityName(city.name), author: city.author, license: city.license }, ...city.gallery]
  const [active, setActive] = useState(0)
  const shown = photos[active]
  const ref = useRef(null)

  // measure the real card before it is painted, then position it
  useLayoutEffect(() => {
    if (anchor && ref.current) placeNear(ref.current, anchor)
  }, [anchor])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // a floating card is pinned to the screen, so it would drift away from its photo on scroll
    if (anchor) window.addEventListener('scroll', onClose, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose)
    }
  }, [onClose, anchor])

  // Slowly flip through the photos while the card is open
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % photos.length), 3200)
    return () => clearInterval(id)
  }, [photos.length, active])

  const card = (
    <article
      className={`city-card${anchor ? ' floating' : ''}`}
      ref={ref}
      role="dialog"
      aria-label={`${cityName(city.name)}, ${countryName(city.name)}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="city-photo">
        {photos.map((p, i) => (
          <img key={p.src} src={p.src} alt={p.caption} className={i === active ? 'on' : ''} decoding="async" />
        ))}
        <div className="card-shade" />
        <button type="button" className="icon-btn close" onClick={onClose} aria-label={tr("Close")}>
          ×
        </button>
        <div className="city-title">
          <span className="city-code">{city.code}</span>
          <h3>{cityName(city.name)}</h3>
          <span>
            <MapPin aria-hidden="true" /> {countryName(city.name)}
          </span>
        </div>
        <span className="city-caption">{shown.caption}</span>
      </div>

      <div className="city-thumbs">
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            className={i === active ? 'active' : ''}
            onClick={() => setActive(i)}
            onPointerEnter={() => setActive(i)}
            aria-label={`Show ${p.caption}`}
          >
            <img src={photoAt(p.src, 330)} alt="" decoding="async" />
          </button>
        ))}
      </div>

      <div className="city-body">
        <p className="city-about">{city.about}</p>

        <dl className="city-facts">
          <div>
            <dt>
              <Plane aria-hidden="true" /> {tr('Flight from {city}', { city: originFrom(from) })}
            </dt>
            <dd>
              {from.city === city.name
                ? tr('You fly from here')
                : from.code === DEFAULT_ORIGIN
                  ? city.flight
                  : flightTime(from, city)}
            </dd>
          </div>
          <div>
            <dt>
              <Sun aria-hidden="true" /> {tr("Best time")}
            </dt>
            <dd>{city.bestTime}</dd>
          </div>
          <div>
            <dt>
              <Languages aria-hidden="true" /> {tr("Language")}
            </dt>
            <dd>{city.language}</dd>
          </div>
          <div>
            <dt>
              <Banknote aria-hidden="true" /> {tr("Currency")}
            </dt>
            <dd>{city.currency}</dd>
          </div>
        </dl>

        {prices && (
          <div className="city-prices">
            <span>
              <strong>
                {prices.flight_estimated ? '~' : ''}
                {money(prices.flight_price, currency)}
              </strong>{' '}
              flight
            </span>
            <span>
              <strong>{money(prices.hotel_per_night, currency)}</strong> {tr("/ night")}
            </span>
            <span>
              <strong>{money(prices.daily_cost, currency)}</strong> {tr("/ day")}
            </span>
          </div>
        )}

        <div className="city-foot">
          <a className="credit" href={commonsPage(shown.src)} target="_blank" rel="noreferrer">
            Photo: {shown.author} · {shown.license}
          </a>
          <button type="button" className="primary small" onClick={onPlan}>
            {tr("Plan a trip")}
          </button>
        </div>
      </div>
    </article>
  )

  if (anchor) return card
  return (
    <div className="overlay" onClick={onClose}>
      {card}
    </div>
  )
}
