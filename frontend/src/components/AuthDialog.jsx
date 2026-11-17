import { useEffect, useRef, useState } from 'react'
import { KeyRound, Luggage, TriangleAlert } from 'lucide-react'
import { CountrySelect, LanguagePicker } from './ProfileFields'
import { useCatalog } from '../hooks'
import { tr } from '../i18n'

const TEXT = {
  login: { icon: KeyRound, title: 'Log in', button: 'Log in', busy: 'Logging in…' },
  signup: { icon: Luggage, title: 'Create an account', button: 'Create account', busy: 'Creating…' },
  delete: { icon: TriangleAlert, title: 'Delete account', button: 'Delete forever', busy: 'Deleting…' },
}

// Log in, sign up, or confirm account deletion with the password.
export default function AuthDialog({ initialMode = 'login', reason, busy, error, onSubmit, onCancel }) {
  const [mode, setMode] = useState(initialMode)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [homeCountry, setHomeCountry] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  // start with the browser's language, e.g. "lt-LT" -> lt
  const [languages, setLanguages] = useState(() => [(navigator.language || 'en').slice(0, 2).toLowerCase()])
  const { catalog } = useCatalog()
  const langs = catalog ? languages.filter((l) => catalog.languages.some((x) => x.code === l)) : []
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, mode])

  const t = TEXT[mode]
  const userOk = /^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim())
  const valid =
    mode === 'delete'
      ? password.length > 0
      : mode === 'login'
        ? username.trim().length > 0 && password.length > 0
        : userOk && password.length >= 8 && displayName.trim().length >= 2 && homeCountry && langs.length > 0 && acceptTerms

  const switchTo = (next) => {
    setMode(next)
    setPassword('')
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) onSubmit({ mode, username: username.trim(), password, displayName: displayName.trim(), homeCountry, languages: langs, acceptTerms })
        }}
      >
        <span className={`dialog-icon${mode === 'delete' ? ' danger' : ''}`} aria-hidden="true">
          <t.icon />
        </span>
        <h2 id="auth-title">{tr(t.title)}</h2>
        {mode === 'delete' ? (
          <p>
            {tr("This deletes your account, your saved tickets on the server, and every chat message you sent. Tickets in this browser are cleared too. Type your password to confirm.")}
          </p>
        ) : (
          reason && <p>{reason}</p>
        )}

        {mode !== 'delete' && (
          <label className="field">
            <span className="label">{tr("Username")}</span>
            <div className="pill-input">
              <input
                ref={firstRef}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
                placeholder={tr("e.g. vita.travels")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {mode === 'signup' && username && !userOk && (
              <span className="hint">{tr("3–30 characters: letters, numbers, . _ or -")}</span>
            )}
          </label>
        )}

        {mode === 'signup' && (
          <>
            <div className="field">
              <label className="label" htmlFor="signup-country">
                {tr("Where are you from?")}
              </label>
              <CountrySelect id="signup-country" catalog={catalog} value={homeCountry} onChange={setHomeCountry} />
              <span className="hint">{tr("Used to show which travel documents you need, and to let you guide visitors at home.")}</span>
            </div>
            <div className="field">
              <span className="label">{tr("Languages you speak")}</span>
              <LanguagePicker
                catalog={catalog}
                value={langs}
                onChange={setLanguages}
              />
            </div>
          </>
        )}

        {mode === 'signup' && (
          <label className="field">
            <span className="label">{tr("Display name")}</span>
            <div className="pill-input">
              <input
                maxLength={30}
                autoComplete="nickname"
                placeholder={tr("What other travellers see")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </label>
        )}

        <label className="field">
          <span className="label">{tr("Password")}</span>
          <div className="pill-input">
            <input
              ref={mode === 'delete' ? firstRef : undefined}
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              maxLength={128}
              placeholder={mode === 'signup' ? tr('At least 8 characters') : ''}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="link small"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? tr('Hide password') : tr('Show password')}
            >
              {showPassword ? tr('Hide') : tr('Show')}
            </button>
          </div>
        </label>

        {mode === 'signup' && (
          <label className="check-line">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
            <span>
              I&apos;m 18 or older and I agree to the{' '}
              <a href="#/terms" target="_blank" rel="noreferrer">
                {tr("Terms")}
              </a>{' '}
              and{' '}
              <a href="#/privacy" target="_blank" rel="noreferrer">
                {tr("Privacy policy")}
              </a>
              .
            </span>
          </label>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {tr("Cancel")}
          </button>
          <button type="submit" className={`primary small${mode === 'delete' ? ' danger-btn' : ''}`} disabled={!valid || busy}>
            {busy ? tr(t.busy) : tr(t.button)}
          </button>
        </div>

        {mode === 'login' && (
          <p className="dialog-switch">
            New here?{' '}
            <button type="button" className="link" onClick={() => switchTo('signup')}>
              {tr("Create an account")}
            </button>
          </p>
        )}
        {mode === 'signup' && (
          <p className="dialog-switch">
            Already have an account?{' '}
            <button type="button" className="link" onClick={() => switchTo('login')}>
              {tr("Log in")}
            </button>
          </p>
        )}
      </form>
    </div>
  )
}
