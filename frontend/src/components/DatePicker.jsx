import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { followScroll, onPressOutside, placePopup } from '../popup'
import { locale, tr } from '../i18n'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const toIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromIso = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (iso, n) => {
  const d = fromIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}
const addMonths = (iso, n) => {
  const d = fromIso(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toIso(d)
}
const label = (iso) => fromIso(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

// 6 weeks starting on the Monday before the 1st of the month
const monthGrid = (iso) => {
  const first = fromIso(iso)
  first.setDate(1)
  const start = toIso(first)
  const offset = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => addDays(start, i - offset))
}

/** A date field with a calendar that matches the app (instead of the browser's grey one). */
export default function DatePicker({ value, onChange, min, placeholder = tr('Pick a date'), ariaLabel, className = '' }) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState('') // highlighted day while the calendar is open
  const buttonRef = useRef(null)
  const popRef = useRef(null)
  const today = toIso(new Date())

  const allowed = (iso) => !min || iso >= min
  const openCalendar = () => {
    setCursor(value || (min && min > today ? min : today))
    setOpen(true)
  }
  const close = (focusButton = true) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }
  const choose = (iso) => {
    if (!allowed(iso)) return
    onChange(iso)
    close()
  }

  useLayoutEffect(() => {
    if (!open || !popRef.current) return
    const update = () =>
      popRef.current && buttonRef.current && placePopup(popRef.current, buttonRef.current, { maxHeight: 380, minWidth: 288 })
    update()
    popRef.current.focus()
    return followScroll(update)
  }, [open])

  useEffect(() => {
    if (!open) return
    return onPressOutside(() => [popRef.current, buttonRef.current], () => setOpen(false))
  }, [open])

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openCalendar()
      }
      return
    }
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in moves) {
      e.preventDefault()
      setCursor((c) => addDays(c, moves[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      setCursor((c) => addMonths(c, e.key === 'PageUp' ? -1 : 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // don't also close the dialog behind
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  const month = cursor ? fromIso(cursor) : null
  const canGoBack = !min || addMonths(cursor || today, -1).slice(0, 7) >= min.slice(0, 7)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`date-btn ${className}${open ? ' open' : ''}${value ? '' : ' empty'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${value ? label(value) : placeholder}` : undefined}
        onClick={() => (open ? close() : openCalendar())}
        onKeyDown={onKeyDown}
      >
        <svg className="date-icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1.5" y="2.5" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M1.5 6.5h13M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="date-value">{value ? label(value) : placeholder}</span>
      </button>

      {open && (
        <div
          ref={popRef}
          className="calendar"
          role="dialog"
          aria-label={ariaLabel || 'Choose a date'}
          tabIndex={-1}
          onKeyDown={onKeyDown}
        >
          <div className="calendar-head">
            <button
              type="button"
              className="calendar-nav"
              disabled={!canGoBack}
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label={tr("Previous month")}
            >
              ‹
            </button>
            <strong aria-live="polite">
              {month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}
            </strong>
            <button
              type="button"
              className="calendar-nav"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label={tr("Next month")}
            >
              ›
            </button>
          </div>
          <div className="calendar-grid" role="grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="calendar-wd" aria-hidden="true">
                {tr(w)}
              </span>
            ))}
            {monthGrid(cursor).map((iso) => {
              const d = fromIso(iso)
              const classes = [
                'calendar-day',
                d.getMonth() !== month.getMonth() && 'other',
                iso === today && 'today',
                iso === value && 'selected',
                iso === cursor && 'cursor',
              ]
              return (
                <button
                  key={iso}
                  type="button"
                  tabIndex={-1}
                  className={classes.filter(Boolean).join(' ')}
                  disabled={!allowed(iso)}
                  aria-label={label(iso)}
                  aria-pressed={iso === value}
                  onPointerMove={() => allowed(iso) && iso !== cursor && setCursor(iso)}
                  onClick={() => choose(iso)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="calendar-foot">
            {value && (
              <button
                type="button"
                className="link"
                onClick={() => {
                  onChange('')
                  close()
                }}
              >
                {tr("Clear")}
              </button>
            )}
            {allowed(today) && (
              <button type="button" className="link" onClick={() => choose(today)}>
                {tr("Today")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
