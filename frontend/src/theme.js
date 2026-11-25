import { useSyncExternalStore } from 'react'

// Light or dark. Follows the device until the person picks one; the pick is remembered.
// index.html sets data-theme before the app loads, so the page never flashes the wrong colours.

const KEY = 'trip-planner:theme'
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null

const saved = () => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

let current = saved() || (media?.matches ? 'dark' : 'light')
const listeners = new Set()

const apply = () => {
  document.documentElement.dataset.theme = current
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current === 'dark' ? '#141c1a' : '#fce6cc')
}
if (typeof document !== 'undefined') apply()

const update = (theme) => {
  if (theme === current) return
  current = theme
  apply()
  listeners.forEach((fn) => fn())
}

// Follow the device while the person hasn't chosen
media?.addEventListener?.('change', (e) => {
  if (!saved()) update(e.matches ? 'dark' : 'light')
})

export const getTheme = () => current

export const setTheme = (theme) => {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* just won't be remembered */
  }
  update(theme)
}

export const useTheme = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getTheme,
  )
