import { useEffect, useState } from 'react'
import { IdCard } from 'lucide-react'
import { CountrySelect, LanguagePicker } from './ProfileFields'
import { useCatalog } from '../hooks'
import { errorText, safetyApi } from '../chat'
import { tr } from '../i18n'

export default function ProfileDialog({ token, user, busy, error, onSave, onCancel }) {
  const [blocked, setBlocked] = useState(null) // people you blocked
  const [blockError, setBlockError] = useState('')
  const [name, setName] = useState(user.display_name)
  const [country, setCountry] = useState(user.home_country || '')
  const [languages, setLanguages] = useState(user.languages || [])
  const { catalog } = useCatalog()

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    let alive = true
    safetyApi
      .blocks(token)
      .then((d) => alive && setBlocked(d.blocked))
      .catch((e) => alive && setBlockError(errorText(e)))
    return () => {
      alive = false
    }
  }, [token])

  const unblock = async (person) => {
    try {
      await safetyApi.unblock(token, person.id)
      setBlocked((prev) => prev.filter((b) => b.id !== person.id))
    } catch (e) {
      setBlockError(errorText(e))
    }
  }

  const valid = name.trim().length >= 2 && name.trim().length <= 30 && country && languages.length > 0

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) onSave({ display_name: name.trim(), home_country: country, languages })
        }}
      >
        <span className="dialog-icon" aria-hidden="true">
          <IdCard />
        </span>
        <h2 id="profile-title">{tr("Your profile")}</h2>
        <p>{tr("Other travellers and locals see your name, country and languages.")}</p>

        <label className="field">
          <span className="label">{tr("Display name")}</span>
          <div className="pill-input">
            <input maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </label>
        <div className="field">
          <label className="label" htmlFor="profile-country">
            {tr("Where are you from?")}
          </label>
          <CountrySelect id="profile-country" catalog={catalog} value={country} onChange={setCountry} />
        </div>
        <div className="field">
          <span className="label">{tr("Languages you speak")}</span>
          <LanguagePicker catalog={catalog} value={languages} onChange={setLanguages} />
        </div>

        {blocked?.length > 0 && (
          <div className="field">
            <span className="label">{tr("People you blocked")}</span>
            <ul className="blocked-list">
              {blocked.map((b) => (
                <li key={b.id}>
                  <span>{b.name}</span>
                  <button type="button" className="link small" onClick={() => unblock(b)}>
                    {tr("Unblock")}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {blockError && <p className="form-error">{blockError}</p>}

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {tr("Cancel")}
          </button>
          <button type="submit" className="primary small" disabled={!valid || busy}>
            {busy ? tr('Saving…') : tr('Save')}
          </button>
        </div>
      </form>
    </div>
  )
}
