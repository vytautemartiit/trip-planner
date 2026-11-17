import { useEffect, useRef, useState } from 'react'
import { FileText, ShieldCheck } from 'lucide-react'
import { cityName } from '../destinations'
import { formatRange, stayDates } from '../chat'
import { tr } from '../i18n'

const MAX_FILES = 4
const MAX_MB = 5

// Prove the trip is real by uploading the airline's PDF before meeting anyone
export default function VerifyDialog({ ticket, busy, error, onVerify, onCancel }) {
  const [files, setFiles] = useState([])
  const [localError, setLocalError] = useState('')
  const inputRef = useRef(null)
  const stays = stayDates(ticket)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const pick = (list) => {
    const chosen = [...list].slice(0, MAX_FILES)
    const bad = chosen.find((f) => !/\.pdf$/i.test(f.name) && f.type !== 'application/pdf')
    const big = chosen.find((f) => f.size > MAX_MB * 1024 * 1024)
    setLocalError(bad ? `${bad.name} isn't a PDF` : big ? `${big.name} is over ${MAX_MB} MB` : '')
    setFiles(bad || big ? [] : chosen)
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (files.length && !busy) onVerify(files)
        }}
      >
        <span className="dialog-icon" aria-hidden="true">
          <ShieldCheck />
        </span>
        <h2 id="verify-title">{tr("Verify your trip")}</h2>
        <p>
          {tr("To keep the community safe, only people who really travel can chat and meet locals. Upload the PDF ticket or booking confirmation you got from the airline.")}
        </p>

        <div className="shared-list">
          <strong>{tr("We check that it mentions")}</strong>
          <ul>
            {stays.map((s) => (
              <li key={s.destination + s.start_date}>
                {cityName(s.destination)} <span className="muted">({formatRange(s.start_date, s.end_date)})</span>
              </li>
            ))}
            <li>Your departure date: {formatRange(stays[0].start_date, stays[0].start_date)}</li>
          </ul>
          <span>
            {tr("The file is read once and not kept — we only store a fingerprint so it can't be reused on another account. If you change the dates later, you'll need to verify again.")}
          </span>
        </div>

        <button
          type="button"
          className={`drop-zone${files.length ? ' has-files' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files)
          }}
        >
          {files.length ? (
            files.map((f) => <span key={f.name}>
                <FileText aria-hidden="true" /> {f.name}
              </span>)
          ) : (
            <>
              <strong>{tr("Choose PDF files")}</strong>
              <span>or drop them here · up to {MAX_FILES} (e.g. outbound and onward flights)</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />

        {(localError || error) && <p className="form-error">{localError || error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            {tr("Cancel")}
          </button>
          <button type="submit" className="primary small" disabled={!files.length || busy}>
            {busy ? tr('Checking…') : tr('Verify')}
          </button>
        </div>
      </form>
    </div>
  )
}
