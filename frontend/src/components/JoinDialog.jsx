import { useEffect, useRef, useState } from 'react'
import { Hand } from 'lucide-react'
import { tr } from '../i18n'

// Asked once per account, the first time someone turns on "Meet travellers".
// The name comes from the account; changing it here renames the account.
export default function JoinDialog({ defaultName = '', onJoin, onCancel, busy, error }) {
  const [name, setName] = useState(defaultName)
  const [agreed, setAgreed] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const valid = name.trim().length >= 2 && name.trim().length <= 30 && agreed

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) onJoin(name.trim())
        }}
      >
        <span className="dialog-icon" aria-hidden="true">
          <Hand />
        </span>
        <h2 id="join-title">{tr("Meet other travellers")}</h2>
        <p>
          {tr("Chat with people who will be in the same country at the same time as you. You choose which tickets to share, and you can turn it off whenever you like.")}
        </p>

        <label className="field">
          <span className="label">{tr("Your name in the chat")}</span>
          <div className="pill-input">
            <input
              ref={inputRef}
              maxLength={30}
              placeholder={tr("e.g. Vita")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </label>

        <div className="shared-list">
          <strong>{tr("What others will see")}</strong>
          <ul>
            <li>{tr("Your display name")}</li>
            <li>{tr("The city and dates of each stop on the tickets you share")}</li>
            <li>{tr("Messages you send in that country's chat")}</li>
          </ul>
          <span>{tr("Only travellers whose dates overlap yours can see you. Never share your address, phone number or other personal details.")}</span>
        </div>

        <label className="consent">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{tr("I agree to share this information with other travellers")}</span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {tr("Not now")}
          </button>
          <button type="submit" className="primary small" disabled={!valid || busy}>
            {busy ? tr('Turning on…') : tr('Turn on')}
          </button>
        </div>
      </form>
    </div>
  )
}
