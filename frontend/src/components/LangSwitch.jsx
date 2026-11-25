import { LANGS, setLang, tr, useLang } from '../i18n'

// EN | LT toggle in the top bar
export default function LangSwitch() {
  const lang = useLang()
  return (
    <div className="lang-switch" role="group" aria-label={tr('Language')}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          title={l.name}
          aria-pressed={lang === l.code}
          className={lang === l.code ? 'active' : ''}
          onClick={() => setLang(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
