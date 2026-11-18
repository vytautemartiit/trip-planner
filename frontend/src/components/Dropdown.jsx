import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { followScroll, onPressOutside, placePopup } from '../popup'
import { tr } from '../i18n'

/**
 * A select that matches the app's look.
 * options: [{ value, label, hint?, icon? }]
 */
export default function Dropdown({
  value,
  options,
  onChange,
  placeholder = tr('Choose…'),
  searchable = false,
  id,
  ariaLabel,
  leading = null,
  className = '',
  ref,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const listId = useId()
  useImperativeHandle(ref, () => ({ focus: () => buttonRef.current?.focus() }), [])

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  const selected = options.find((o) => o.value === value)

  const openList = () => {
    const i = options.findIndex((o) => o.value === value)
    setQuery('')
    setActive(Math.max(0, i))
    setOpen(true)
  }

  const close = (focusButton = true) => {
    setOpen(false)
    if (focusButton) buttonRef.current?.focus()
  }

  const choose = (o) => {
    if (!o) return
    onChange(o.value)
    close()
  }

  // position, then keep it attached while the page or a dialog scrolls
  useLayoutEffect(() => {
    if (!open || !listRef.current) return
    const update = () => listRef.current && buttonRef.current && placePopup(listRef.current, buttonRef.current)
    update()
    if (searchable) searchRef.current?.focus()
    else listRef.current.focus()
    return followScroll(update)
  }, [open, searchable])

  // keep the highlighted option visible
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  // close when clicking anywhere else
  useEffect(() => {
    if (!open) return
    return onPressOutside(() => [listRef.current, buttonRef.current], () => setOpen(false))
  }, [open])

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation() // don't also close the dialog behind
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : shown.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(shown[active])
    } else if (e.key === 'Tab') {
      close(false)
    } else if (!searchable && e.key.length === 1) {
      // jump to the first option starting with the typed letter
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className={`dropdown-btn ${className}${open ? ' open' : ''}${selected ? '' : ' empty'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
      >
        {leading}
        <span className="dropdown-value">{selected ? selected.label : placeholder}</span>
        <svg className="dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div ref={listRef} className="dropdown-list" tabIndex={-1} onKeyDown={onKeyDown}>
          {searchable && (
            <div className="dropdown-search">
              <input
                ref={searchRef}
                value={query}
                placeholder={tr("Type to search…")}
                aria-label={tr("Search")}
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel || placeholder}>
            {shown.length === 0 && <li className="dropdown-none">{tr("No matches")}</li>}
            {shown.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                className={`${i === active ? 'active' : ''}${o.value === value ? ' selected' : ''}`}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => choose(o)}
              >
                {o.icon}
                <span className="dropdown-label">{o.label}</span>
                {o.hint && <small>{o.hint}</small>}
                {o.value === value && (
                  <span className="dropdown-check" aria-hidden="true">
                    <Check />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
