import { AssetItem } from '@/types'
import { CONSERVATION_STATES, formatSignedYear } from './numismaticaMeta'
import { ASSET_CATEGORIES, getCategoryInfo, type CollectionKey } from './assetCategories'

export type NumismaticaGroupBy =
  | 'location'
  | 'owner'
  | 'material'
  | 'conservation'
  | 'era'
  | 'type'
  | 'category'
  | 'none'

export type NumismaticaSortBy =
  | 'inventory'
  | 'name'
  | 'value-desc'
  | 'year-asc'
  | 'material'
  | 'conservation'
  | 'country'
  | 'category'

const GROUP_LABELS: Record<Exclude<NumismaticaGroupBy, 'none'>, string> = {
  location: 'Ubicación',
  owner: 'Propietario',
  material: 'Material',
  conservation: 'Conservación',
  era: 'Época',
  type: 'Tipo',
  category: 'Categoría',
}

export const NUMISMATICA_GROUP_OPTIONS = (Object.keys(GROUP_LABELS) as Array<Exclude<NumismaticaGroupBy, 'none'>>).map((value) => ({
  value,
  label: GROUP_LABELS[value],
}))

export const NUMISMATICA_SORT_OPTIONS: Array<{ value: NumismaticaSortBy; label: string }> = [
  { value: 'inventory', label: 'Número del archivador' },
  { value: 'name', label: 'Nombre' },
  { value: 'value-desc', label: 'Valor: mayor a menor' },
  { value: 'year-asc', label: 'Año: más antiguo' },
  { value: 'material', label: 'Material' },
  { value: 'conservation', label: 'Conservación' },
  { value: 'country', label: 'País / origen' },
]

/**
 * Grouping options that make sense for each collection. Numismática keeps its
 * own set; "Todos" can group by category and by object type; the rest group
 * by their common attributes.
 */
export function groupOptionsForCollection(collection: CollectionKey): Array<{ value: NumismaticaGroupBy; label: string }> {
  if (collection === 'numismatica') {
    return (['location', 'owner', 'material', 'conservation', 'era', 'type'] as const)
      .map((value) => ({ value, label: GROUP_LABELS[value] }))
  }
  if (collection === 'todos') {
    return (['category', 'type', 'owner', 'material', 'conservation', 'era'] as const)
      .map((value) => ({ value, label: GROUP_LABELS[value] }))
  }
  return (['owner', 'material', 'conservation', 'era'] as const)
    .map((value) => ({ value, label: GROUP_LABELS[value] }))
}

/** Sorting options available in each collection. */
export function sortOptionsForCollection(collection: CollectionKey): Array<{ value: NumismaticaSortBy; label: string }> {
  if (collection === 'numismatica') return NUMISMATICA_SORT_OPTIONS
  const base: Array<{ value: NumismaticaSortBy; label: string }> = [
    { value: 'name', label: 'Nombre' },
    { value: 'value-desc', label: 'Valor: mayor a menor' },
    { value: 'year-asc', label: 'Año: más antiguo' },
    { value: 'material', label: 'Material' },
    { value: 'conservation', label: 'Conservación' },
    { value: 'country', label: 'País / origen' },
  ]
  if (collection === 'todos') base.splice(1, 0, { value: 'category', label: 'Categoría' })
  return base
}

export type ConservationTone = {
  chip: string
  dot: string
  text: string
}

const CONSERVATION_TONES: Record<string, ConservationTone> = {
  excelente: {
    chip: 'border-sky-700 bg-sky-950/70 text-sky-200',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
  },
  muybuena: {
    chip: 'border-emerald-700 bg-emerald-950/70 text-emerald-200',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  buenestado: {
    chip: 'border-lime-700 bg-lime-950/70 text-lime-200',
    dot: 'bg-lime-400',
    text: 'text-lime-300',
  },
  regular: {
    chip: 'border-yellow-700 bg-yellow-950/70 text-yellow-200',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
  },
  desgastado: {
    chip: 'border-amber-700 bg-amber-950/70 text-amber-200',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  muydesgastado: {
    chip: 'border-orange-700 bg-orange-950/70 text-orange-200',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
  },
  dañado: {
    chip: 'border-red-700 bg-red-950/70 text-red-200',
    dot: 'bg-red-400',
    text: 'text-red-300',
  },
}

const FALLBACK_TONE: ConservationTone = {
  chip: 'border-slate-700 bg-slate-950 text-slate-300',
  dot: 'bg-slate-500',
  text: 'text-slate-300',
}

export function normalizeUiText(value: string | undefined | null): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

export function conservationTone(state?: string): ConservationTone {
  return CONSERVATION_TONES[normalizeUiText(state).replace(/\s+/g, '')] ?? FALLBACK_TONE
}

export function conservationRank(state?: string): number {
  const key = normalizeUiText(state)
  const index = CONSERVATION_STATES.findIndex((item) => normalizeUiText(item) === key)
  return index === -1 ? CONSERVATION_STATES.length : index
}

export function coinValue(asset: AssetItem): number {
  return asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price ?? 0
}

/** Valor de referencia de cualquier bien, usado por listas y estadísticas. */
export function assetValue(asset: AssetItem): number {
  return asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price ?? 0
}

export function hasValue(asset: AssetItem): boolean {
  return (asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price) !== undefined
}

export function isMedal(asset: AssetItem): boolean {
  return asset.numismatica_type === 'medalla'
}

function isNumismaticaAsset(asset: AssetItem): boolean {
  return normalizeUiText(asset.category) === 'numismatica'
}

/** Icon that identifies the asset in lists and fallback photos. */
export function assetIcon(asset: AssetItem): string {
  if (isNumismaticaAsset(asset)) return isMedal(asset) ? '🏅' : '🪙'
  return getCategoryInfo(asset.category).icon
}

/** Tooltip for the list icon. */
export function assetIconTitle(asset: AssetItem): string {
  if (isNumismaticaAsset(asset)) return isMedal(asset) ? 'Medalla' : 'Moneda'
  return getCategoryInfo(asset.category).label
}

export function yearLabel(asset: AssetItem): string {
  if (asset.creation_year_range?.trim()) return asset.creation_year_range.trim()
  if (asset.year !== undefined) return formatSignedYear(asset.year)
  return '—'
}

export function sizeLabel(value?: string): string {
  const text = value?.trim()
  if (!text) return ''
  return /[a-zA-Z]/.test(text) ? text : `${text} mm`
}

/** Fourth list column: ceca/tamaño for coins, marca/autor for the rest. */
export function detailLabel(asset: AssetItem): string {
  if (isMedal(asset)) return sizeLabel(asset.medal_size_mm) || '—'
  if (!isNumismaticaAsset(asset)) return asset.brandOrAuthor?.trim() || '—'
  const parts = [asset.mint, asset.mint_mark ? `(${asset.mint_mark})` : '']
  return parts.filter(Boolean).join(' · ') || '—'
}

/** Sixth list column: contenedor for coins, origen for the rest. */
export function locationLabel(asset: AssetItem): string {
  if (isMedal(asset)) return asset.medal_location || '—'
  if (!isNumismaticaAsset(asset)) return asset.placeOfOrigin?.trim() || '—'
  const storage = [asset.case_location, asset.case_number].filter((part): part is string => Boolean(part?.trim())).join(' · ')
  return storage || '—'
}

export function containerLabel(asset: AssetItem): string {
  if (isMedal(asset)) return asset.medal_location?.trim() || 'Sin ubicación'
  if (!isNumismaticaAsset(asset)) return asset.placeOfOrigin?.trim() || 'Sin origen'
  return asset.case_location?.trim() || 'Sin contenedor'
}

/** Número del archivador: usa el inventario y, si no hay, el hueco del contenedor. */
export function inventoryNumber(asset: AssetItem): string {
  return asset.inventory_number?.trim() || asset.case_number?.trim() || ''
}

export function inventorySortValue(asset: AssetItem): number {
  const match = inventoryNumber(asset).match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : Number.POSITIVE_INFINITY
}

/** Position of the category in the canonical list, used to sort by category. */
function categoryRank(value: string | undefined | null): number {
  const normalized = normalizeUiText(value)
  const index = ASSET_CATEGORIES.findIndex((category) => normalizeUiText(category.value) === normalized)
  return index === -1 ? ASSET_CATEGORIES.length : index
}

function groupLabelFor(asset: AssetItem, groupBy: Exclude<NumismaticaGroupBy, 'none'>): string {
  switch (groupBy) {
    case 'location':
      return containerLabel(asset)
    case 'owner':
      return asset.owner?.trim() || 'Sin propietario'
    case 'material':
      return asset.material?.trim() || 'Sin material'
    case 'conservation':
      return asset.conservationState?.trim() || 'Sin estado'
    case 'era':
      return asset.era?.trim() || asset.historicalEra?.trim() || 'Sin época'
    case 'type':
      // Tipo de objeto: moneda/medalla dentro de numismática, categoría fuera.
      return isNumismaticaAsset(asset) ? (isMedal(asset) ? 'Medallas' : 'Monedas') : getCategoryInfo(asset.category).label
    case 'category':
      return getCategoryInfo(asset.category).label
  }
}

function compareOptionalText(a: string, b: string): number {
  const aEmpty = a.startsWith('Sin ') || a === '—'
  const bEmpty = b.startsWith('Sin ') || b === '—'
  if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
  return a.localeCompare(b, 'es', { numeric: true })
}

export function sortNumismaticaAssets(assets: AssetItem[], sortBy: NumismaticaSortBy): AssetItem[] {
  return [...assets].sort((a, b) => {
    switch (sortBy) {
      case 'inventory':
        return inventorySortValue(a) - inventorySortValue(b)
          || a.name.localeCompare(b.name, 'es', { numeric: true })
      case 'value-desc':
        return coinValue(b) - coinValue(a) || a.name.localeCompare(b.name, 'es')
      case 'year-asc':
        return (a.year ?? Number.POSITIVE_INFINITY) - (b.year ?? Number.POSITIVE_INFINITY)
          || a.name.localeCompare(b.name, 'es')
      case 'material':
        return (a.material ?? '').localeCompare(b.material ?? '', 'es')
          || a.name.localeCompare(b.name, 'es')
      case 'conservation':
        return conservationRank(a.conservationState) - conservationRank(b.conservationState)
          || a.name.localeCompare(b.name, 'es')
      case 'country':
        return compareOptionalText(
          a.country?.trim() || a.placeOfOrigin?.trim() || 'Sin país',
          b.country?.trim() || b.placeOfOrigin?.trim() || 'Sin país',
        ) || a.name.localeCompare(b.name, 'es', { numeric: true })
      case 'category':
        return categoryRank(a.category) - categoryRank(b.category)
          || a.name.localeCompare(b.name, 'es', { numeric: true })
      default:
        return a.name.localeCompare(b.name, 'es', { numeric: true })
    }
  })
}

export function groupNumismaticaAssets(
  assets: AssetItem[],
  groupBy: NumismaticaGroupBy,
  containerLabelFor?: (asset: AssetItem) => string,
): Array<{ label: string; items: AssetItem[] }> {
  if (groupBy === 'none') return [{ label: '', items: assets }]

  const map = new Map<string, AssetItem[]>()
  assets.forEach((asset) => {
    // En ubicación se puede inyectar la etiqueta única del contenedor para no
    // mezclar dos álbumes físicos que compartan el mismo nombre.
    const label = groupBy === 'location' && containerLabelFor
      ? containerLabelFor(asset)
      : groupLabelFor(asset, groupBy)
    const list = map.get(label) ?? []
    list.push(asset)
    map.set(label, list)
  })

  const groups = Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  groups.sort((a, b) => {
    if (groupBy === 'conservation') {
      return conservationRank(a.label) - conservationRank(b.label) || compareOptionalText(a.label, b.label)
    }
    if (groupBy === 'category') {
      return categoryRank(a.items[0]?.category) - categoryRank(b.items[0]?.category) || compareOptionalText(a.label, b.label)
    }
    return compareOptionalText(a.label, b.label)
  })
  return groups
}

/** Orden exacto en que la lista muestra las piezas (grupos incluidos). */
export function orderNumismaticaAssets(
  assets: AssetItem[],
  groupBy: NumismaticaGroupBy,
  sortBy: NumismaticaSortBy,
  containerLabelFor?: (asset: AssetItem) => string,
): AssetItem[] {
  return groupNumismaticaAssets(sortNumismaticaAssets(assets, sortBy), groupBy, containerLabelFor)
    .flatMap((group) => group.items)
}
