import { AssetItem } from '@/types'
import { CONSERVATION_STATES, formatSignedYear } from './numismaticaMeta'

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export type NumismaticaGroupBy =
  | 'location'
  | 'owner'
  | 'material'
  | 'conservation'
  | 'era'
  | 'type'
  | 'none'

export type NumismaticaSortBy =
  | 'inventory'
  | 'name'
  | 'value-desc'
  | 'year-asc'
  | 'material'
  | 'conservation'

const GROUP_LABELS: Record<Exclude<NumismaticaGroupBy, 'none'>, string> = {
  location: 'Ubicación',
  owner: 'Propietario',
  material: 'Material',
  conservation: 'Conservación',
  era: 'Época',
  type: 'Tipo',
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
]

export type ConservationTone = {
  chip: string
  dot: string
  text: string
}

const CONSERVATION_TONES: Record<string, ConservationTone> = {
  excelente: {
    chip: 'border-emerald-700 bg-emerald-950/70 text-emerald-200',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  muybuena: {
    chip: 'border-teal-700 bg-teal-950/70 text-teal-200',
    dot: 'bg-teal-400',
    text: 'text-teal-300',
  },
  buenestado: {
    chip: 'border-sky-700 bg-sky-950/70 text-sky-200',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
  },
  regular: {
    chip: 'border-amber-700 bg-amber-950/70 text-amber-200',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  desgastado: {
    chip: 'border-orange-700 bg-orange-950/70 text-orange-200',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
  },
  muydesgastado: {
    chip: 'border-rose-700 bg-rose-950/70 text-rose-200',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
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

export function formatEuro(value?: number): string {
  return value === undefined || Number.isNaN(value) ? '—' : euroFormatter.format(value)
}

export function coinValue(asset: AssetItem): number {
  return asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price ?? 0
}

export function hasValue(asset: AssetItem): boolean {
  return (asset.currentValue ?? asset.market_value ?? asset.value ?? asset.purchase_price) !== undefined
}

export function isMedal(asset: AssetItem): boolean {
  return asset.numismatica_type === 'medalla'
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

export function detailLabel(asset: AssetItem): string {
  if (isMedal(asset)) return sizeLabel(asset.medal_size_mm) || '—'
  const parts = [asset.mint, asset.mint_mark ? `(${asset.mint_mark})` : '']
  return parts.filter(Boolean).join(' · ') || '—'
}

export function locationLabel(asset: AssetItem): string {
  if (isMedal(asset)) return asset.medal_location || '—'
  const storage = [asset.case_location, asset.case_number].filter((part): part is string => Boolean(part?.trim())).join(' · ')
  return storage || '—'
}

export function containerLabel(asset: AssetItem): string {
  if (isMedal(asset)) return asset.medal_location?.trim() || 'Sin ubicación'
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
