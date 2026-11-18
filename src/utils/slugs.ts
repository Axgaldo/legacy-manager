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
  const contextualMatches = assets.filter((item) => `${slugify(item.name) || 'bien'}-${slugify(item.category)}-${slugify(asset.owner || 'gabriel')}` === withContext)
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

export type AssetSlugIndex = {
  bySlug: Map<string, AssetItem>
  slugById: Map<string, string>
}

/**
 * Índice de slugs en una sola pasada. `assetSlug` recorre toda la colección por
 * cada ficha (O(n²), varios segundos con miles de monedas); esto se calcula una
 * vez por carga y deja las búsquedas en O(1).
 */
export function buildAssetSlugIndex(assets: AssetItem[]): AssetSlugIndex {
  const byBase = new Map<string, AssetItem[]>()
  assets.forEach((asset) => {
    const base = slugify(asset.name) || 'bien'
    const group = byBase.get(base)
    if (group) group.push(asset)
    else byBase.set(base, [asset])
  })

  const bySlug = new Map<string, AssetItem>()
  const slugById = new Map<string, string>()

  const assign = (slug: string, asset: AssetItem) => {
    if (!bySlug.has(slug)) bySlug.set(slug, asset)
    slugById.set(asset.id, slug)
  }

  byBase.forEach((group, base) => {
    if (group.length === 1) {
      assign(base, group[0])
      return
    }

    const byContext = new Map<string, AssetItem[]>()
    group.forEach((asset) => {
      const context = `${base}-${slugify(asset.category)}-${slugify(asset.owner || 'gabriel')}`
      const peers = byContext.get(context)
      if (peers) peers.push(asset)
      else byContext.set(context, [asset])
    })

    byContext.forEach((peers, context) => {
      if (peers.length === 1) {
        assign(context, peers[0])
        return
      }
      const sorted = [...peers].sort((a, b) => timestampValue(a.createdAt) - timestampValue(b.createdAt) || a.id.localeCompare(b.id))
      sorted.forEach((asset, index) => assign(`${context}-${index + 1}`, asset))
    })
  })

  return { bySlug, slugById }
}
