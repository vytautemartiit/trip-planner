import { afterEach, describe, expect, it } from 'vitest'
import { plural, setLang, tr } from '../i18n'
import { LT } from '../i18n-lt'

afterEach(() => setLang('en'))

describe('tr', () => {
  it('returns English as-is and fills placeholders', () => {
    setLang('en')
    expect(tr('Explore')).toBe('Explore')
    expect(tr('{n} found', { n: '3 trips' })).toBe('3 trips found')
  })

  it('translates to Lithuanian and falls back to English for unknown text', () => {
    setLang('lt')
    expect(tr('Explore')).toBe(LT.Explore)
    expect(tr('Some text nobody translated')).toBe('Some text nobody translated')
  })

  it('leaves unknown placeholders alone', () => {
    expect(tr('Hello {name}', {})).toBe('Hello {name}')
  })
})

describe('plural', () => {
  it('uses English singular and plural', () => {
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(5, 'day')).toBe('5 days')
    expect(plural(2, 'country', 'countries')).toBe('2 countries')
  })

  it('uses the three Lithuanian forms', () => {
    setLang('lt')
    expect(plural(1, 'day')).toBe('1 diena')
    expect(plural(2, 'day')).toBe('2 dienos')
    expect(plural(9, 'day')).toBe('9 dienos')
    expect(plural(10, 'day')).toBe('10 dienų')
    expect(plural(11, 'day')).toBe('11 dienų')
    expect(plural(12, 'day')).toBe('12 dienų')
    expect(plural(21, 'day')).toBe('21 diena')
    expect(plural(22, 'day')).toBe('22 dienos')
  })
})

describe('Lithuanian dictionary', () => {
  it('has no empty translations', () => {
    const empty = Object.entries(LT).filter(([, v]) => typeof v !== 'string' || !v.trim())
    expect(empty).toEqual([])
  })
})
