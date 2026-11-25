import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeedbackContext } from '../feedback'
import { tr } from '../i18n'

const TOAST_MS = 5000
const MAX_TOASTS = 3
const TONE_ICON = { success: CircleCheck, error: CircleAlert, info: Info }

function ConfirmDialog({ ask, onAnswer }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onAnswer(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onAnswer])

  return (
    <div className="overlay confirm-overlay" onClick={() => onAnswer(false)}>
      <div
        className="dialog confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`dialog-icon${ask.danger ? ' danger' : ''}`} aria-hidden="true">
          {ask.danger ? <TriangleAlert /> : <Info />}
        </span>
        <h2 id="confirm-title">{ask.title}</h2>
        {ask.text && <p id="confirm-text">{ask.text}</p>}
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="ghost-btn" onClick={() => onAnswer(false)}>
            {ask.cancelLabel || tr('Cancel')}
          </button>
          <button type="button" className={`primary small${ask.danger ? ' danger' : ''}`} onClick={() => onAnswer(true)}>
            {ask.confirmLabel || tr('OK')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ toast, onDismiss }) {
  const Icon = TONE_ICON[toast.tone] || Info
  const { id, tone } = toast
  const onClose = () => onDismiss(id)
  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), tone === 'error' ? TOAST_MS * 2 : TOAST_MS)
    return () => clearTimeout(t)
  }, [id, tone, onDismiss])

  return (
    <div className={`toast ${toast.tone || 'info'}`}>
      <Icon className="toast-icon" aria-hidden="true" />
      <span className="toast-text">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action.onClick()
            onClose()
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label={tr("Dismiss")}>
        <X />
      </button>
    </div>
  )
}

/** Gives the whole app toast messages and a confirm dialog in the app's own style. */
export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [ask, setAsk] = useState(null) // { title, text, confirmLabel, danger, resolve }
  const nextId = useRef(1)

  const toast = useCallback((text, options = {}) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, text, ...options }])
  }, [])

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setAsk({ ...options, resolve })
      }),
    [],
  )

  const answer = useCallback(
    (yes) => {
      ask?.resolve(yes)
      setAsk(null)
    },
    [ask],
  )

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
      {ask && <ConfirmDialog ask={ask} onAnswer={answer} />}
    </FeedbackContext.Provider>
  )
}
