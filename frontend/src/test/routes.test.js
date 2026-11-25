import { describe, expect, it } from 'vitest'
import { parseHash, searchPath, tripPath, viewPath } from '../routes'

describe('trip links', () => {
  const trip = { origin: 'RIX', startDate: '2026-12-24', stops: [{ destination: 'Prague', days: 3 }, { destination: 'Budapest', days: 2 }] }

  it('builds a short, readable link', () => {
    expect(tripPath(trip, 'EUR')).toBe('#/trip/RIX/PRG-3,BUD-2?date=2026-12-24')
    expect(tripPath({ ...trip, startDate: '' }, 'USD')).toBe('#/trip/RIX/PRG-3,BUD-2?cur=USD')
  })

  it('reads a link back', () => {
    expect(parseHash('#/trip/rix/PRG-3,BUD-2?date=2026-12-24&cur=GBP')).toEqual({
      view: null,
      trip: { origin: 'RIX', stops: 'PRG-3,BUD-2', startDate: '2026-12-24', currency: 'GBP' },
    })
  })

  it('ignores a bad date and an unknown currency', () => {
    const { trip: t } = parseHash('#/trip/VNO/PRG-3?date=tomorrow&cur=XYZ')
    expect(t.startDate).toBe('')
    expect(t.currency).toBe('EUR')
  })
})

describe('search links', () => {
  it('round-trips the search settings', () => {
    const p = { budget: 500, days: 5, countries: 2, origin: 'RIX', startDate: '2026-12-24', currency: 'PLN' }
    const { view, search } = parseHash(searchPath(p))
    expect(view).toBe('explore')
    expect(search).toEqual(p)
  })

  it('keeps defaults out of the link', () => {
    expect(searchPath({ budget: 300, days: 4, countries: 1, origin: 'VNO', currency: 'EUR' })).toBe('#/?budget=300&days=4')
  })

  it('rejects nonsense values', () => {
    expect(parseHash('#/?budget=-5&days=5').search).toBeNull()
    expect(parseHash('#/?budget=500&days=999').search).toBeNull()
    expect(parseHash('#/?budget=500&days=5&from=XXX').search.origin).toBeNull()
  })
})

describe('pages', () => {
  it('maps views to paths and back', () => {
    expect(viewPath('explore')).toBe('#/')
    expect(viewPath('privacy')).toBe('#/privacy')
    expect(parseHash('#/tickets').view).toBe('tickets')
    expect(parseHash('#/nowhere').view).toBe('explore')
  })
})
