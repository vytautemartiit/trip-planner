import { beforeAll, describe, expect, it, vi } from 'vitest'
import { convert, loadRates, money, tidy } from '../rates'

describe('exchange rates', () => {
  it('shows EUR until the rates arrive', () => {
    expect(money(120, 'USD')).toBe('€120')
  })

  describe('after loading', () => {
    beforeAll(async () => {
      vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ base: 'EUR', rates: { USD: 1.1, CZK: 25 } }) }))
      await loadRates()
      vi.unstubAllGlobals()
    })

    it('converts EUR prices to the chosen currency', () => {
      expect(money(120, 'USD')).toBe('$132')
      expect(money(120, 'CZK')).toBe('3,000 Kč')
      expect(money(120)).toBe('€120')
    })

    it('converts a budget between currencies', () => {
      expect(convert(500, 'EUR', 'CZK')).toBe(12500)
      expect(convert(12500, 'CZK', 'USD')).toBeCloseTo(550)
    })
  })

  it('rounds budgets to tidy steps', () => {
    expect(tidy(553)).toBe(550)
    expect(tidy(12534)).toBe(12500)
    expect(tidy(3)).toBe(10)
  })
})
