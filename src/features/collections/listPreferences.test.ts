import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LIST_PREFERENCES,
  preferencesFromParams,
  preferencesToParams,
  type ListPreferences,
} from './listPreferences'

const defaults: ListPreferences = {
  ...DEFAULT_LIST_PREFERENCES,
  groupBy: 'location',
  sortBy: 'inventory',
}

describe('preferencias de lista', () => {
  it('conserva país, álbum y vista de álbumes en la URL', () => {
    const preferences: ListPreferences = {
      ...defaults,
      sortBy: 'country',
      country: 'República Romana',
      album: 'Álbum 1 · Hoja 1||romanos/Denarios república',
      view: 'albums',
    }

    const params = preferencesToParams(preferences, defaults)
    const parsed = preferencesFromParams(params, defaults)

    expect(parsed.hasParams).toBe(true)
    expect(parsed.preferences.sortBy).toBe('country')
    expect(parsed.preferences.country).toBe('República Romana')
    expect(parsed.preferences.album).toBe('Álbum 1 · Hoja 1||romanos/Denarios república')
    expect(parsed.preferences.view).toBe('albums')
  })

  it('sin parámetros devuelve los valores por defecto', () => {
    const parsed = preferencesFromParams(new URLSearchParams(), defaults)
    expect(parsed.hasParams).toBe(false)
    expect(parsed.preferences.country).toBe('all')
    expect(parsed.preferences.album).toBe('all')
    expect(parsed.preferences.view).toBe('list')
  })

  it('ignora vistas desconocidas', () => {
    const parsed = preferencesFromParams(new URLSearchParams('vista=otra'), defaults)
    expect(parsed.preferences.view).toBe('list')
    expect(parsed.hasParams).toBe(false)
  })
})
