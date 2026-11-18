import { Globe } from 'lucide-react'

// A small flag picture. Flag emoji don't exist on Windows (they show up as two letters, "LT"),
// so we ship the flag-icons SVGs with the app. Each flag is its own small file, loaded only when shown.
const FLAGS = import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default', eager: true })
const urlFor = (code) => FLAGS[`/node_modules/flag-icons/flags/4x3/${code}.svg`]

export default function Flag({ code, className = '' }) {
  const src = code && /^[A-Za-z]{2}$/.test(code) ? urlFor(code.toLowerCase()) : null
  if (!src) {
    return (
      <span className={`flag flag-none ${className}`} aria-hidden="true">
        <Globe />
      </span>
    )
  }
  return (
    <img
      className={`flag ${className}`}
      src={src}
      width="20"
      height="15"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
    />
  )
}
