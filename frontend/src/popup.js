const GAP = 6
const EDGE = 8

// Put a popup (dropdown list, calendar) under its button, or above it when there's no room below.
// The popup is position: fixed, so scrolling dialogs can't cut it off.
export const placePopup = (popup, button, { maxHeight = 280, minWidth = 200 } = {}) => {
  const r = button.getBoundingClientRect()
  const vh = window.innerHeight
  const below = vh - r.bottom - GAP - EDGE
  const above = r.top - GAP - EDGE
  const up = below < Math.min(maxHeight, popup.scrollHeight) && above > below
  const room = Math.max(120, Math.min(maxHeight, up ? above : below))
  const width = Math.max(r.width, minWidth)
  popup.style.left = `${Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE))}px`
  popup.style.minWidth = `${Math.min(width, window.innerWidth - 2 * EDGE)}px`
  popup.style.maxHeight = `${room}px`
  popup.style.top = up ? 'auto' : `${r.bottom + GAP}px`
  popup.style.bottom = up ? `${vh - r.top + GAP}px` : 'auto'
}

// Calls onOutside when the user presses anywhere outside the given elements.
export const onPressOutside = (elements, onOutside) => {
  const onDown = (e) => {
    if (!elements().some((el) => el?.contains(e.target))) onOutside()
  }
  document.addEventListener('pointerdown', onDown)
  return () => document.removeEventListener('pointerdown', onDown)
}

// Re-run `update` while the page or any scrolling parent moves.
export const followScroll = (update) => {
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update, true)
  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update, true)
  }
}
