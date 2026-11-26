import { useSyncExternalStore } from 'react'
import { BASE_URL } from './api'
import { formatMoney } from './utils'

// Today's exchange rates from EUR (fetched once from the backend), so every price can be shown in the
// chosen currency. Prices in the app are stored in EUR. Until the rates arrive, prices stay in EUR.

let rates = { EUR: 1 }
let request = null
const listeners = new Set()

export const loadRates = () => {
  request ??= fetch(`${BASE_URL}/rates`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
    .then((data) => {
      rates = { ...data.rates, EUR: 1 }
      listeners.forEach((fn) => fn())
    })
    .catch(() => {
      request = null // try again next time
    })
  return request
}

/** EUR -> currency rate, or null if not known yet */
export const rateFor = (currency) => rates[currency] ?? null

/** Re-render when the rates arrive */
export const useRates = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => rates,
  )

/** A EUR amount shown in the chosen currency: money(120, 'USD') -> "$130" */
export const money = (amountEur, currency = 'EUR') => {
  const rate = rateFor(currency)
  return rate == null ? formatMoney(amountEur, 'EUR') : formatMoney(amountEur * rate, currency)
}

/** Round a budget to a tidy step for its size (10, 50, 100, 500…) */
export const tidy = (n) => {
  const step = n >= 20000 ? 500 : n >= 5000 ? 100 : n >= 1000 ? 50 : 10
  return Math.max(step, Math.round(n / step) * step)
}

/** Convert an amount between two currencies with today's rates (unchanged if a rate is missing) */
export const convert = (amount, from, to) => {
  const a = rateFor(from)
  const b = rateFor(to)
  return a == null || b == null ? amount : (amount / a) * b
}
