import { locale } from './i18n'

// Country and language names in the current language, straight from the browser (Intl.DisplayNames),
// so "LT" shows as "Lithuania" in English and "Lietuva" in Lithuanian.

const cache = new Map()
const displayNames = (type) => {
  const key = `${locale()}:${type}`
  if (!cache.has(key)) {
    try {
      cache.set(key, new Intl.DisplayNames([locale()], { type }))
    } catch {
      cache.set(key, null)
    }
  }
  return cache.get(key)
}

const capital = (s) => (s ? s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1) : s)

/** "LT" -> "Lithuania" / "Lietuva" (or '' if the browser doesn't know) */
export const regionName = (code) => {
  try {
    const n = displayNames('region')?.of(code.toUpperCase())
    return n && n !== code.toUpperCase() ? n : ''
  } catch {
    return ''
  }
}

/** "lt" -> "Lithuanian" / "Lietuvių" */
export const languageName = (code) => {
  try {
    const n = displayNames('language')?.of(code)
    return n && n !== code ? capital(n) : ''
  } catch {
    return ''
  }
}

const sorted = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name, locale()))

/** Countries and languages with names in the current language, sorted for that language */
export const localCountries = (countries) => sorted(countries.map((c) => ({ ...c, name: regionName(c.code) || c.name })))
export const localLanguages = (languages) => sorted(languages.map((l) => ({ ...l, name: languageName(l.code) || l.name })))
