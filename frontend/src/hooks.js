import { COUNTRIES, LANGUAGES } from './countries'
import { useLang } from './i18n'
import { localCountries, localLanguages } from './names'

const built = {}

// Countries and languages people can pick, named and sorted in the current language.
// They ship with the app, so the pickers never come up empty.
export function useCatalog() {
  const lang = useLang()
  built[lang] ??= { countries: localCountries(COUNTRIES), languages: localLanguages(LANGUAGES) }
  return { catalog: built[lang], failed: false }
}
