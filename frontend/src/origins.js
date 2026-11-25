import { getLang } from './i18n'
// Airports you can fly from (generated from backend/origins.py; keep the two in sync).
// Fares are exact from Vilnius and estimated from everywhere else.

export const DEFAULT_ORIGIN = 'VNO'

export const ORIGINS = [
  { code: 'VNO', city: 'Vilnius', country: 'Lithuania', iso: 'LT', lat: 54.6872, lng: 25.2797 },
  { code: 'KUN', city: 'Kaunas', country: 'Lithuania', iso: 'LT', lat: 54.8985, lng: 23.9036 },
  { code: 'PLQ', city: 'Palanga', country: 'Lithuania', iso: 'LT', lat: 55.9175, lng: 21.0686 },
  { code: 'RIX', city: 'Riga', country: 'Latvia', iso: 'LV', lat: 56.9496, lng: 24.1052 },
  { code: 'TLL', city: 'Tallinn', country: 'Estonia', iso: 'EE', lat: 59.437, lng: 24.7536 },
  { code: 'HEL', city: 'Helsinki', country: 'Finland', iso: 'FI', lat: 60.1699, lng: 24.9384 },
  { code: 'ARN', city: 'Stockholm', country: 'Sweden', iso: 'SE', lat: 59.3293, lng: 18.0686 },
  { code: 'OSL', city: 'Oslo', country: 'Norway', iso: 'NO', lat: 59.9139, lng: 10.7522 },
  { code: 'CPH', city: 'Copenhagen', country: 'Denmark', iso: 'DK', lat: 55.6761, lng: 12.5683 },
  { code: 'WAW', city: 'Warsaw', country: 'Poland', iso: 'PL', lat: 52.2297, lng: 21.0122 },
  { code: 'GDN', city: 'Gdańsk', country: 'Poland', iso: 'PL', lat: 54.352, lng: 18.6466 },
  { code: 'BER', city: 'Berlin', country: 'Germany', iso: 'DE', lat: 52.52, lng: 13.405 },
  { code: 'FRA', city: 'Frankfurt', country: 'Germany', iso: 'DE', lat: 50.1109, lng: 8.6821 },
  { code: 'MUC', city: 'Munich', country: 'Germany', iso: 'DE', lat: 48.1351, lng: 11.582 },
  { code: 'VIE', city: 'Vienna', country: 'Austria', iso: 'AT', lat: 48.2082, lng: 16.3738 },
  { code: 'ZRH', city: 'Zurich', country: 'Switzerland', iso: 'CH', lat: 47.3769, lng: 8.5417 },
  { code: 'BRU', city: 'Brussels', country: 'Belgium', iso: 'BE', lat: 50.8503, lng: 4.3517 },
  { code: 'CDG', city: 'Paris', country: 'France', iso: 'FR', lat: 48.8566, lng: 2.3522 },
  { code: 'LON', city: 'London', country: 'United Kingdom', iso: 'GB', lat: 51.5072, lng: -0.1276 },
  { code: 'DUB', city: 'Dublin', country: 'Ireland', iso: 'IE', lat: 53.3498, lng: -6.2603 },
  { code: 'MAD', city: 'Madrid', country: 'Spain', iso: 'ES', lat: 40.4168, lng: -3.7038 },
  { code: 'MXP', city: 'Milan', country: 'Italy', iso: 'IT', lat: 45.4642, lng: 9.19 },
  { code: 'KIV', city: 'Chișinău', country: 'Moldova', iso: 'MD', lat: 47.0105, lng: 28.8638 },
  { code: 'KBP', city: 'Kyiv', country: 'Ukraine', iso: 'UA', lat: 50.4501, lng: 30.5234 },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', iso: 'ES', lat: 41.3874, lng: 2.1686 },
  { code: 'FCO', city: 'Rome', country: 'Italy', iso: 'IT', lat: 41.9028, lng: 12.4964 },
  { code: 'LIS', city: 'Lisbon', country: 'Portugal', iso: 'PT', lat: 38.7223, lng: -9.1393 },
  { code: 'PRG', city: 'Prague', country: 'Czechia', iso: 'CZ', lat: 50.0755, lng: 14.4378 },
  { code: 'BUD', city: 'Budapest', country: 'Hungary', iso: 'HU', lat: 47.4979, lng: 19.0402 },
  { code: 'KRK', city: 'Kraków', country: 'Poland', iso: 'PL', lat: 50.0647, lng: 19.945 },
  { code: 'AMS', city: 'Amsterdam', country: 'Netherlands', iso: 'NL', lat: 52.3676, lng: 4.9041 },
  { code: 'ATH', city: 'Athens', country: 'Greece', iso: 'GR', lat: 37.9838, lng: 23.7275 },
]

export const originOf = (code) => ORIGINS.find((o) => o.code === code) || ORIGINS[0]

// The airport to suggest for someone from this country (first one listed), if any
export const originForCountry = (iso) => ORIGINS.find((o) => o.iso === iso)?.code

const rad = (d) => (d * Math.PI) / 180
export const distanceKm = (a, b) => {
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Rough direct flight time: ~30 min for take-off and landing plus ~800 km/h in the air
export const flightTime = (from, to) => {
  const minutes = Math.round((30 + (distanceKm(from, to) / 800) * 60) / 5) * 5
  const h = Math.floor(minutes / 60)
  return `~${h ? `${h} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim()
}

// Lithuanian names: [name, "from" form], e.g. Vilnius / iš Vilniaus
const LT_NAMES = {
  VNO: ['Vilnius', 'Vilniaus'], KUN: ['Kaunas', 'Kauno'], PLQ: ['Palanga', 'Palangos'], RIX: ['Ryga', 'Rygos'],
  TLL: ['Talinas', 'Talino'], HEL: ['Helsinkis', 'Helsinkio'], ARN: ['Stokholmas', 'Stokholmo'], OSL: ['Oslas', 'Oslo'],
  CPH: ['Kopenhaga', 'Kopenhagos'], WAW: ['Varšuva', 'Varšuvos'], GDN: ['Gdanskas', 'Gdansko'], BER: ['Berlynas', 'Berlyno'],
  FRA: ['Frankfurtas', 'Frankfurto'], MUC: ['Miunchenas', 'Miuncheno'], VIE: ['Viena', 'Vienos'], ZRH: ['Ciurichas', 'Ciuricho'],
  BRU: ['Briuselis', 'Briuselio'], CDG: ['Paryžius', 'Paryžiaus'], LON: ['Londonas', 'Londono'], DUB: ['Dublinas', 'Dublino'],
  MAD: ['Madridas', 'Madrido'], MXP: ['Milanas', 'Milano'], KIV: ['Kišiniovas', 'Kišiniovo'], KBP: ['Kyjivas', 'Kyjivo'],
  BCN: ['Barselona', 'Barselonos'], FCO: ['Roma', 'Romos'], LIS: ['Lisabona', 'Lisabonos'], PRG: ['Praha', 'Prahos'],
  BUD: ['Budapeštas', 'Budapešto'], KRK: ['Krokuva', 'Krokuvos'], AMS: ['Amsterdamas', 'Amsterdamo'], ATH: ['Atėnai', 'Atėnų'],
}

/** The airport's city in the current language. */
export const originName = (o) => (getLang() === 'lt' && LT_NAMES[o.code] ? LT_NAMES[o.code][0] : o.city)
/** The form used after "from": "London" / "Londono". */
export const originFrom = (o) => (getLang() === 'lt' && LT_NAMES[o.code] ? LT_NAMES[o.code][1] : o.city)
