import { Flag as FlagIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { errorText, safetyApi } from '../chat'
import { useFeedback } from '../feedback'
import { tr } from '../i18n'

const REASONS = [
  ['harassment', 'Harassment or threats'],
  ['inappropriate', 'Sexual or inappropriate messages'],
  ['scam', 'Scam, asking for money or personal details'],
  ['spam', 'Spam or advertising'],
  ['fake_trip', "Isn't really travelling / fake profile"],
  ['underage', 'Seems to be under 18'],
  ['other', 'Something else'],
]

/** Report someone (and usually block them) from the chat or Meet a local. */
export default function ReportDialog({ token, person, where, onDone, onCancel }) {
  const { toast } = useFeedback()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [block, setBlock] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const valid = reason && (reason !== 'other' || details.trim().length >= 10)

  const send = async (onlyBlock) => {
    setBusy(true)
    setError('')
    try {
      if (onlyBlock) {
        await safetyApi.block(token, person.id)
        toast(`${person.name} is blocked. You won't see each other any more.`, { tone: 'success' })
      } else {
        await safetyApi.report(token, { user_id: person.id, reason, details: details.trim(), where, block })
        toast(
          block
            ? `Thanks for telling us. ${person.name} is blocked and our team will look at your report.`
            : 'Thanks for telling us. Our team will look at your report.',
          { tone: 'success' },
        )
      }
      onDone(onlyBlock || block)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !busy) send(false)
        }}
      >
        <span className="dialog-icon danger" aria-hidden="true">
          <FlagIcon />
        </span>
        <h2 id="report-title">Report {person.name}</h2>
        <p>Reports are private — {person.name} won&apos;t know who sent it. If you&apos;re in danger, call 112.</p>

        <fieldset className="report-reasons">
          <legend className="label">{tr("What happened?")}</legend>
          {REASONS.map(([value, label]) => (
            <label key={value} className={`report-reason${reason === value ? ' selected' : ''}`}>
              <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
              <span>{tr(label)}</span>
            </label>
          ))}
        </fieldset>

        <label className="field">
          <span className="label">Details {reason === 'other' ? '' : '(optional)'}</span>
          <textarea
            className="text-box"
            rows={3}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={tr("What did they say or do?")}
          />
        </label>

        <label className="check-line">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
          <span>Also block {person.name} — you won&apos;t see each other in the chat or Meet a local.</span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={() => send(true)} disabled={busy}>
            {tr("Just block")}
          </button>
          <button type="submit" className="primary small danger" disabled={!valid || busy}>
            {busy ? tr('Sending…') : tr('Send report')}
          </button>
        </div>
      </form>
    </div>
  )
}
