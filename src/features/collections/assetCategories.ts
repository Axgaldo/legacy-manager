import { AssetCategory } from '@/types'

export type CollectionKey = 'numismatica' | 'arte' | 'objetos'

export interface AssetCategoryInfo {
  value: AssetCategory
  label: string
  icon: string
  collection: CollectionKey
}

export interface CollectionInfo {
  key: CollectionKey
  label: string
  icon: string
  description: string
}

/**
 * Canonical categories used by the app. Only the three primary collections
 * remain; everything stored under an older category is normalized on read.
 */
export const ASSET_CATEGORIES: AssetCategoryInfo[] = [
  { value: 'numismatica', label: 'Numismática', icon: '🪙', collection: 'numismatica' },
  { value: 'arte', label: 'Arte y cuadros', icon: '🎨', collection: 'arte' },
  { value: 'objetos', label: 'Objetos diversos', icon: '📦', collection: 'objetos' },
]

export const PRIMARY_COLLECTIONS: CollectionInfo[] = [
  { key: 'numismatica', label: 'Numismática', icon: '🪙', description: 'Monedas de todas las épocas' },
  { key: 'arte', label: 'Arte y cuadros', icon: '🎨', description: 'Cuadros, esculturas y obra gráfica' },
  { key: 'objetos', label: 'Objetos diversos', icon: '📦', description: 'Relojes, joyas, libros y otros bienes' },
]

export const COLLECTION_MAP = new Map<CollectionKey, CollectionInfo>(PRIMARY_COLLECTIONS.map((collection) => [collection.key, collection]))
export const CATEGORY_MAP = new Map<AssetCategory, AssetCategoryInfo>(ASSET_CATEGORIES.map((category) => [category.value, category]))

const CANONICAL_CATEGORIES = new Set<string>(ASSET_CATEGORIES.map((category) => category.value))

/**
 * Categories stored by previous versions of the app. They are normalized on
 * read so existing Firestore documents keep working without a migration.
 */
const LEGACY_CATEGORY_ALIASES: Record<string, AssetCategory> = {
  coins: 'numismatica',
  banknotes: 'numismatica',
  art: 'arte',
  antiques: 'objetos',
  furniture: 'objetos',
  watches: 'objetos',
  jewelry: 'objetos',
  electronics: 'objetos',
  computers: 'objetos',
  vehicles: 'objetos',
  books: 'objetos',
  stamps: 'objetos',
  'musical-instruments': 'objetos',
  sports: 'objetos',
  tools: 'objetos',
  documents: 'objetos',
  collectibles: 'objetos',
  other: 'objetos',
}

export function normalizeAssetCategory(value: unknown): AssetCategory {
  if (typeof value !== 'string') return 'objetos'
  const key = value.trim().toLocaleLowerCase()
  if (CANONICAL_CATEGORIES.has(key)) return key as AssetCategory
  return LEGACY_CATEGORY_ALIASES[key] ?? 'objetos'
}

export function getCategoryInfo(value?: string | null): AssetCategoryInfo {
  return CATEGORY_MAP.get(normalizeAssetCategory(value)) ?? CATEGORY_MAP.get('objetos')!
}

export function categoryCollection(value?: string | null): CollectionKey {
  return getCategoryInfo(value).collection
}

export function isCollectionKey(value?: string | null): value is CollectionKey {
  return value === 'numismatica' || value === 'arte' || value === 'objetos'
}

export function matchesCollection(category: string | undefined | null, collection: CollectionKey): boolean {
  return categoryCollection(category) === collection
}

export function categoriesForCollection(collection: CollectionKey): AssetCategoryInfo[] {
  return ASSET_CATEGORIES.filter((category) => category.collection === collection)
}
