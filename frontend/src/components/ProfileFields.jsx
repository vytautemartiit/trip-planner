import Dropdown from './Dropdown'
import { Languages } from 'lucide-react'
import Flag from './Flag'
import { tr } from '../i18n'

export function CountrySelect({ catalog, value, onChange, id }) {
  return (
    <Dropdown
      id={id}
      className="pill"
      searchable
      value={value}
      onChange={onChange}
      placeholder={tr("Choose your country…")}
      ariaLabel="Country"
      leading={<Flag code={value} />}
      options={(catalog?.countries || []).map((c) => ({ value: c.code, label: c.name, icon: <Flag code={c.code} /> }))}
    />
  )
}

export function LanguagePicker({ catalog, value, onChange }) {
  const names = Object.fromEntries((catalog?.languages || []).map((l) => [l.code, l.name]))
  const left = (catalog?.languages || []).filter((l) => !value.includes(l.code))
  return (
    <div className="lang-picker">
      {value.map((code) => (
        <span key={code} className="lang-chip">
          {names[code] || code}
          <button
            type="button"
            onClick={() => onChange(value.filter((c) => c !== code))}
            aria-label={`Remove ${names[code] || code}`}
          >
            ×
          </button>
        </span>
      ))}
      {value.length < 10 && (
        <Dropdown
          className="chip-add"
          searchable
          value=""
          onChange={(code) => onChange([...value, code])}
          placeholder={tr("+ Add language")}
          ariaLabel={tr("Add a language")}
          options={left.map((l) => ({ value: l.code, label: l.name }))}
        />
      )}
    </div>
  )
}

export function LanguageList({ codes, catalog }) {
  if (!codes?.length) return null
  const names = Object.fromEntries((catalog?.languages || []).map((l) => [l.code, l.name]))
  return <span className="lang-list">
      <Languages aria-hidden="true" /> {codes.map((c) => names[c] || c.toUpperCase()).join(', ')}</span>
}
