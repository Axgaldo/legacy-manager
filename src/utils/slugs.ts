import { AssetItem, Property } from '@/types'

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function propertySlug(property: Property, properties: Property[]): string {
  const base = slugify(property.name) || 'inmueble'
  const duplicates = properties.filter((item) => (slugify(item.name) || 'inmueble') === base)
  if (duplicates.length <= 1) return base

  const withContext = `${base}-${slugify(property.city || property.owner)}`
  const contextualMatches = properties.filter((item) => `${base}-${slugify(item.city || item.owner)}` === withContext)
  if (contextualMatches.length <= 1) return withContext
  return `${withContext}-${stableOrdinal(property, contextualMatches)}`
}

export function assetSlug(asset: AssetItem, assets: AssetItem[]): string {
  const base = slugify(asset.name) || 'bien'
  const duplicates = assets.filter((item) => (slugify(item.name) || 'bien') === base)
  if (duplicates.length <= 1) return base

  const withContext = `${base}-${slugify(asset.category)}-${slugify(asset.owner || 'gabriel')}`
  const contextualMatches = assets.filter((item) => `${slugify(item.name) || 'bien'}-${slugify(item.category)}-${slugify(item.owner || 'gabriel')}` === withContext)
  if (contextualMatches.length <= 1) return withContext
  return `${withContext}-${stableOrdinal(asset, contextualMatches)}`
}

function stableOrdinal<T extends { id: string; createdAt?: any }>(item: T, peers: T[]): number {
  const sorted = [...peers].sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt) || a.id.localeCompare(b.id))
  return sorted.findIndex((peer) => peer.id === item.id) + 1
}

function timestampValue(value: any): number {
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Date.parse(String(value || '')) || 0
}
