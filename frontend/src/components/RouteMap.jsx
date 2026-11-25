import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cityName, countryName, findCity } from '../destinations'
import { originOf } from '../origins'
import { ROUTE_COLORS, formatMoney, plural } from '../utils'
import { tr } from '../i18n'
import { useTheme } from '../theme'

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Curved "flight" line between two points (quadratic Bézier in lat/lng space)
function arc(from, to, steps = 32) {
  const [lat1, lng1] = from
  const [lat2, lng2] = to
  const bend = 0.18
  const cLat = (lat1 + lat2) / 2 - (lng2 - lng1) * bend
  const cLng = (lng1 + lng2) / 2 + (lat2 - lat1) * bend
  const points = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = (1 - t) * (1 - t)
    const b = 2 * (1 - t) * t
    const c = t * t
    points.push([a * lat1 + b * cLat + c * lat2, a * lng1 + b * cLng + c * lng2])
  }
  return points
}

/**
 * routes: [{ key, color, label, stops: [{ destination, days, total_cost }] }]
 * highlight: key of the route to emphasise (others fade out)
 * numbered: show stop numbers inside the markers (single-route view)
 * activeIndex: stop to mark as selected (single-route view)
 * onStopClick(routeKey, stopIndex)
 */
export default function RouteMap({ routes, highlight = null, numbered = false, activeIndex = -1, onStopClick, className = '' }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const fittedRef = useRef('')
  const clickRef = useRef(onStopClick)
  // The near-black route line would vanish on the dark map, so it turns peach there
  const dark = useTheme() === 'dark'

  useEffect(() => {
    clickRef.current = onStopClick
  }, [onStopClick])

  // Create the map once
  useEffect(() => {
    const map = L.map(elRef.current, {
      scrollWheelZoom: false,
      zoomSnap: 0.25,
      worldCopyJump: true,
    }).setView([48, 12], 4)
    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // Scroll-zoom only after the user clicks into the map, so the page still scrolls
    map.on('click', () => map.scrollWheelZoom.enable())
    map.on('mouseout', () => map.scrollWheelZoom.disable())

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(elRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      fittedRef.current = ''
    }
  }, [])

  // Draw routes and markers
  useEffect(() => {
    const paint = (c) => (dark && c === ROUTE_COLORS[0] ? '#f6e3cb' : c)
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const bounds = L.latLngBounds([])
    const groups = new Map() // city -> { city, entries: [{ route, stop, index }] }
    const starts = new Map() // airport code -> airport, one pin each

    routes.forEach((route) => {
      const faded = highlight && highlight !== route.key
      const strong = highlight === route.key
      const from = originOf(route.origin)
      starts.set(from.code, from)
      const origin = [from.lat, from.lng]
      bounds.extend(origin)
      const pts = [origin]

      route.stops.forEach((stop, index) => {
        const city = findCity(stop.destination)
        if (!city) return
        const ll = [city.lat, city.lng]
        pts.push(ll)
        bounds.extend(ll)
        const g = groups.get(city.name) || { city, entries: [] }
        g.entries.push({ route, stop, index })
        groups.set(city.name, g)
      })

      for (let i = 0; i < pts.length - 1; i++) {
        L.polyline(arc(pts[i], pts[i + 1]), {
          color: paint(route.color),
          weight: strong ? 4 : 3,
          opacity: faded ? 0.12 : 0.9,
          dashArray: '1 7',
          lineCap: 'round',
          interactive: false,
        }).addTo(layer)
      }
      // faint way home
      if (pts.length > 1) {
        L.polyline(arc(pts[pts.length - 1], origin), {
          color: paint(route.color),
          weight: 2,
          opacity: faded ? 0.05 : 0.25,
          dashArray: '2 8',
          interactive: false,
        }).addTo(layer)
      }
    })

    // Where the trips start
    if (!starts.size) starts.set(originOf().code, originOf())
    starts.forEach((from) => {
      if (!bounds.isValid()) bounds.extend([from.lat, from.lng])
      L.marker([from.lat, from.lng], {
        icon: L.divIcon({
          className: 'map-pin-wrap',
          html: `<span class="map-origin">${from.code}</span>`,
          iconSize: [44, 24],
          iconAnchor: [22, 12],
        }),
        keyboard: false,
      })
        .bindTooltip(`<div class="tt"><strong>${from.city}</strong><span>Departure · ${from.code}</span></div>`, {
          direction: 'top',
          offset: [0, -10],
          className: 'map-tooltip',
        })
        .addTo(layer)
    })

    // One marker per city; the tooltip lists the days for every ticket that stops there
    groups.forEach(({ city, entries }) => {
      const first = entries[0]
      const faded = highlight && !entries.some((e) => e.route.key === highlight)
      const active = numbered && entries.some((e) => e.index === activeIndex)
      const color = paint((entries.find((e) => e.route.key === highlight) || first).route.color)
      const label = numbered ? first.index + 1 : ''

      const html = `<span class="map-pin${active ? ' active' : ''}${faded ? ' faded' : ''}" style="--c:${color}">${label}</span>`

      let body
      if (routes.length === 1) {
        const { stop, index } = first
        body = `<b class="tt-days">${esc(plural(stop.days, 'day'))}</b> {tr("staying here")}
          <span>Stop ${index + 1} of ${first.route.stops.length}${stop.total_cost != null ? ` · ${esc(formatMoney(stop.total_cost))}` : ''}</span>`
      } else {
        body = entries
          .map(
            (e) =>
              `<span class="tt-row"><i style="background:${paint(e.route.color)}"></i>${esc(e.route.label)} · <b>${esc(plural(e.stop.days, 'day'))}</b></span>`,
          )
          .join('')
      }

      const marker = L.marker([city.lat, city.lng], {
        icon: L.divIcon({ className: 'map-pin-wrap', html, iconSize: [30, 30], iconAnchor: [15, 15] }),
        title: `${cityName(city.name)}`,
        riseOnHover: true,
        zIndexOffset: active ? 1000 : 0,
      })
        .bindTooltip(
          `<div class="tt"><strong>${esc(city.name)}</strong><span>${esc(countryName(city.name))}</span>${body}</div>`,
          { direction: 'top', offset: [0, -14], className: 'map-tooltip' },
        )
        .addTo(layer)

      marker.on('click', () => {
        marker.openTooltip()
        clickRef.current?.(first.route.key, first.index)
      })
    })

    // Re-frame only when the set of routes changes, not on every hover
    const signature = routes.map((r) => r.key).join('/')
    if (fittedRef.current !== signature) {
      fittedRef.current = signature
      map.fitBounds(bounds.pad(0.15), { maxZoom: 6, animate: false })
    }
  }, [routes, highlight, numbered, activeIndex, dark])

  return <div ref={elRef} className={`route-map ${className}`} role="region" aria-label={tr("Route map")} />
}
