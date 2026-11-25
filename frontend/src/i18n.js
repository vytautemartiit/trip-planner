import { useSyncExternalStore } from 'react'
import { LT, LT_PLURALS } from './i18n-lt'

// English and Lithuanian. The English text is the key: tr('Find trips') -> 'Ieškoti kelionių'.
// Anything without a translation simply stays in English.

const KEY = 'trip-planner:lang'
export const LANGS = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'lt', label: 'LT', name: 'Lietuvių' },
]

const initial = () => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'lt') return saved
  } catch {
    /* storage blocked */
  }
  return (navigator.language || '').toLowerCase().startsWith('lt') ? 'lt' : 'en'
}

let current = initial()
const listeners = new Set()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = () => current
export const locale = () => (current === 'lt' ? 'lt-LT' : 'en-GB')

export const setLang = (lang) => {
  if (lang === current) return
  current = lang
  document.documentElement.lang = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* the choice just won't be remembered */
  }
  listeners.forEach((fn) => fn())
}

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Re-render when the language changes. */
export const useLang = () => useSyncExternalStore(subscribe, getLang)

/** Translate, filling in {placeholders}: tr('{n} found', { n: 3 }) */
export const tr = (text, vars) => {
  const s = current === 'lt' ? (LT[text] ?? text) : text
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s
}

// Lithuanian has three plural forms: 1 diena, 2 dienos, 10 dienų (21 diena, 22 dienos, 11–19 dienų)
const ltForm = (n) => {
  const tens = Math.abs(n) % 100
  const ones = Math.abs(n) % 10
  if (ones === 1 && tens !== 11) return 0
  if (ones >= 2 && tens < 10) return 1
  if (ones >= 2 && tens > 19) return 1
  return 2
}

/** "3 days" / "3 dienos". `one` is the English singular, which also picks the Lithuanian forms. */
export const plural = (n, one, many = `${one}s`) => {
  if (current === 'lt' && LT_PLURALS[one]) return `${n} ${LT_PLURALS[one][ltForm(n)]}`
  return `${n} ${n === 1 ? one : many}`
}
