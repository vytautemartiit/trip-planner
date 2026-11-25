import { Moon, Sun } from 'lucide-react'
import { tr } from '../i18n'
import { setTheme, useTheme } from '../theme'

// Sun / moon button in the top bar
export default function ThemeToggle() {
  const dark = useTheme() === 'dark'
  const label = dark ? tr('Switch to light mode') : tr('Switch to dark mode')
  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  )
}
