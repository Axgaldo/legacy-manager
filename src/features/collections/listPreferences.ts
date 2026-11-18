import type { NumismaticaGroupBy, NumismaticaSortBy } from './numismaticaUi'

export type ListView = 'list' | 'grid'

export type ListPreferences = {
  groupBy: NumismaticaGroupBy
  sortBy: NumismaticaSortBy
  owner: string
  category: string
  tags: string[]
  material: string
  conservation: string
  era: string
  type: string
  onlyReview: boolean
  view: ListView
}

export const DEFAULT_LIST_PREFERENCES: ListPreferences = {
  groupBy: 'location',
  sortBy: 'name',
  owner: 'all',
  category: 'all',
  tags: [],
  material: 'all',
  conservation: 'all',
  era: 'all',
  type: 'all',
  onlyReview: false,
  view: 'list',
}

const GROUP_VALUES: NumismaticaGroupBy[] = ['location', 'owner', 'material', 'conservation', 'era', 'type', 'category', 'none']
const SORT_VALUES: NumismaticaSortBy[] = ['inventory', 'name', 'value-desc', 'year-asc', 'material', 'conservation', 'category']
const TYPE_VALUES = ['all', 'moneda', 'medalla']
const VIEW_VALUES: ListView[] = ['list', 'grid']

const PARAM = {
  group: 'agrupar',
  sort: 'orden',
  owner: 'propietario',
  category: 'categoria',
  tags: 'etiquetas',
  material: 'material',
  conservation: 'estado',
  era: 'epoca',
  type: 'tipo',
  review: 'revisar',
  view: 'vista',
} as const

function isGroup(value: string): value is NumismaticaGroupBy {
  return GROUP_VALUES.includes(value as NumismaticaGroupBy)
}

function isSort(value: string): value is NumismaticaSortBy {
  return SORT_VALUES.includes(value as NumismaticaSortBy)
}

function isView(value: string): value is ListView {
  return VIEW_VALUES.includes(value as ListView)
}

/** Lee la lista de preferencias de la URL; `hasParams` indica si había algo guardado. */
export function preferencesFromParams(
  params: URLSearchParams,
  defaults: ListPreferences,
): { preferences: ListPreferences; hasParams: boolean } {
  const preferences: ListPreferences = { ...defaults }
  let hasParams = false

  const group = params.get(PARAM.group)
  if (group && isGroup(group)) {
    preferences.groupBy = group
    hasParams = true
  }
  const sort = params.get(PARAM.sort)
  if (sort && isSort(sort)) {
    preferences.sortBy = sort
    hasParams = true
  }
  const owner = params.get(PARAM.owner)
  if (owner) {
    preferences.owner = owner
    hasParams = true
  }
  const category = params.get(PARAM.category)
  if (category) {
    preferences.category = category
    hasParams = true
  }
  const material = params.get(PARAM.material)
  if (material) {
    preferences.material = material
    hasParams = true
  }
  const conservation = params.get(PARAM.conservation)
  if (conservation) {
    preferences.conservation = conservation
    hasParams = true
  }
  const era = params.get(PARAM.era)
  if (era) {
    preferences.era = era
    hasParams = true
  }
  const type = params.get(PARAM.type)
  if (type && TYPE_VALUES.includes(type)) {
    preferences.type = type
    hasParams = true
  }
  const tags = params.get(PARAM.tags)
  if (tags) {
    preferences.tags = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    hasParams = true
  }
  const review = params.get(PARAM.review)
  if (review === '1') {
    preferences.onlyReview = true
    hasParams = true
  }
  const view = params.get(PARAM.view)
  if (view && isView(view)) {
    preferences.view = view
    hasParams = true
  }

  return { preferences, hasParams }
}

/** Serializa solo lo que se aparta de los valores por defecto, para URLs cortas. */
export function preferencesToParams(preferences: ListPreferences, defaults: ListPreferences): URLSearchParams {
  const params = new URLSearchParams()
  if (preferences.groupBy !== defaults.groupBy) params.set(PARAM.group, preferences.groupBy)
  if (preferences.sortBy !== defaults.sortBy) params.set(PARAM.sort, preferences.sortBy)
  if (preferences.owner !== defaults.owner) params.set(PARAM.owner, preferences.owner)
  if (preferences.category !== defaults.category) params.set(PARAM.category, preferences.category)
  if (preferences.material !== defaults.material) params.set(PARAM.material, preferences.material)
  if (preferences.conservation !== defaults.conservation) params.set(PARAM.conservation, preferences.conservation)
  if (preferences.era !== defaults.era) params.set(PARAM.era, preferences.era)
  if (preferences.type !== defaults.type) params.set(PARAM.type, preferences.type)
  if (preferences.tags.length > 0 && preferences.tags.join(',') !== defaults.tags.join(',')) {
    params.set(PARAM.tags, preferences.tags.join(','))
  }
  if (preferences.onlyReview !== defaults.onlyReview) params.set(PARAM.review, '1')
  if (preferences.view !== defaults.view) params.set(PARAM.view, preferences.view)
  return params
}

const STORAGE_PREFIX = 'legacy-manager:lista:'

export function loadPreferences(collectionKey: string, defaults: ListPreferences): ListPreferences | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${collectionKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ListPreferences>
    return {
      ...defaults,
      ...parsed,
      groupBy: parsed.groupBy && isGroup(parsed.groupBy) ? parsed.groupBy : defaults.groupBy,
      sortBy: parsed.sortBy && isSort(parsed.sortBy) ? parsed.sortBy : defaults.sortBy,
      view: parsed.view && isView(parsed.view) ? parsed.view : defaults.view,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    }
  } catch {
    return null
  }
}

export function savePreferences(collectionKey: string, preferences: ListPreferences): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${collectionKey}`, JSON.stringify(preferences))
  } catch {
    // Sin localStorage (modo privado): se sigue usando la URL.
  }
}
