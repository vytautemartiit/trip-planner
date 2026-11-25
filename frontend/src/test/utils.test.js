import { afterEach, describe, expect, it } from 'vitest'
import { formatMoney, normalizeTrip, routeCodes } from '../utils'
import { distanceKm, originFrom, originOf } from '../origins'
import { setLang } from '../i18n'

afterEach(() => setLang('en'))

describe('formatMoney', () => {
  it('puts the symbol where people expect it', () => {
    expect(formatMoney(120)).toBe('€120')
    expect(formatMoney(120, 'USD')).toBe('$120')
    expect(formatMoney(120, 'PLN')).toBe('120 zł')
    expect(formatMoney(120, 'CZK')).toBe('120 Kč')
  })
})

describe('normalizeTrip', () => {
  it('gives one-city trips the old Vilnius key so saved tickets still match', () => {
    const t = normalizeTrip({ destination: 'Prague', days: 3, total_cost: 200 })
    expect(t).toMatchObject({ key: 'Prague', multi: false, origin: 'VNO', days: 3 })
    expect(t.stops).toHaveLength(1)
  })

  it('prefixes the key with the airport for other origins', () => {
    expect(normalizeTrip({ origin: 'RIX', destination: 'Prague', days: 3 }).key).toBe('RIX>Prague')
  })

  it('handles multi-country trips', () => {
    const t = normalizeTrip({
      origin: 'RIX',
      countries: ['Prague', 'Budapest'],
      breakdown: [{ destination: 'Prague', days: 3 }, { destination: 'Budapest', days: 2 }],
      total_days: 5,
      total_cost: 300,
    })
    expect(t).toMatchObject({ key: 'RIX>Prague|Budapest', multi: true, days: 5 })
    expect(routeCodes(t)).toBe('RIX → PRG → BUD')
  })
})

describe('origins', () => {
  it('measures distances between airports', () => {
    const km = distanceKm(originOf('VNO'), originOf('RIX'))
    expect(km).toBeGreaterThan(240)
    expect(km).toBeLessThan(300)
  })

  it('uses the Lithuanian "from" form', () => {
    setLang('lt')
    expect(originFrom(originOf('RIX'))).toBe('Rygos')
    setLang('en')
    expect(originFrom(originOf('RIX'))).toBe('Riga')
  })
})
