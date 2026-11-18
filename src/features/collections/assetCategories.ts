import { AssetCategory } from '@/types'

/** Collections that map 1:1 to a stored category. */
export type PrimaryCollectionKey = 'numismatica' | 'arte' | 'relojes' | 'electronica' | 'objetos'

/** Collections shown on the Bienes landing page. `todos` mixes every category. */
export type CollectionKey = 'todos' | PrimaryCollectionKey

export interface AssetCategoryInfo {
  value: AssetCategory
  label: string
  icon: string
  collection: PrimaryCollectionKey
}

export interface CollectionInfo {
  key: CollectionKey
  label: string
  icon: string
  description: string
}

/**
 * Canonical categories used by the app. Everything stored under an older
 * category is normalized on read, so no Firestore migration is needed.
 */
export const ASSET_CATEGORIES: AssetCategoryInfo[] = [
  { value: 'numismatica', label: 'Numismática', icon: '🪙', collection: 'numismatica' },
  { value: 'arte', label: 'Arte y cuadros', icon: '🎨', collection: 'arte' },
  { value: 'relojes', label: 'Relojes', icon: '⌚', collection: 'relojes' },
  { value: 'electronica', label: 'Electrónica y electrodomésticos', icon: '🔌', collection: 'electronica' },
  { value: 'objetos', label: 'Objetos diversos', icon: '📦', collection: 'objetos' },
]

export const COLLECTIONS: CollectionInfo[] = [
  { key: 'todos', label: 'Todos', icon: '🗂️', description: 'Catálogo completo, agrupable por categorías y tipos' },
  { key: 'numismatica', label: 'Numismática', icon: '🪙', description: 'Monedas y medallas de todas las épocas' },
  { key: 'arte', label: 'Arte y cuadros', icon: '🎨', description: 'Cuadros, esculturas y obra gráfica' },
  { key: 'relojes', label: 'Relojes', icon: '⌚', description: 'Relojes de pulsera, de bolsillo y de pared' },
  { key: 'electronica', label: 'Electrónica y electrodomésticos', icon: '🔌', description: 'Aparatos eléctricos, electrónicos y electrodomésticos' },
  { key: 'objetos', label: 'Objetos diversos', icon: '📦', description: 'Joyas, libros y otros bienes' },
]

export const COLLECTION_MAP = new Map<CollectionKey, CollectionInfo>(COLLECTIONS.map((collection) => [collection.key, collection]))
export const CATEGORY_MAP = new Map<AssetCategory, AssetCategoryInfo>(ASSET_CATEGORIES.map((category) => [category.value, category]))

const CANONICAL_CATEGORIES = new Set<string>(ASSET_CATEGORIES.map((category) => category.value))
const COLLECTION_KEYS = new Set<string>(COLLECTIONS.map((collection) => collection.key))

/**
 * Categories stored by previous versions of the app. They are normalized on
 * read so existing Firestore documents keep working without a migration.
 * `watches`, `electronics` and `computers` now land in their own collections.
 */
const LEGACY_CATEGORY_ALIASES: Record<string, AssetCategory> = {
  coins: 'numismatica',
  banknotes: 'numismatica',
  medals: 'numismatica',
  medallas: 'numismatica',
  art: 'arte',
  watches: 'relojes',
  electronics: 'electronica',
  computers: 'electronica',
  appliances: 'electronica',
  antiques: 'objetos',
  furniture: 'objetos',
  jewelry: 'objetos',
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

/** Collection a category belongs to. Never `todos`. */
export function categoryCollection(value?: string | null): PrimaryCollectionKey {
  return getCategoryInfo(value).collection
}

export function isCollectionKey(value?: string | null): value is CollectionKey {
  return typeof value === 'string' && COLLECTION_KEYS.has(value)
}

/** `todos` matches everything; other collections match their own category. */
export function matchesCollection(category: string | undefined | null, collection: CollectionKey): boolean {
  if (collection === 'todos') return true
  return categoryCollection(category) === collection
}

export function categoriesForCollection(collection: PrimaryCollectionKey): AssetCategoryInfo[] {
  return ASSET_CATEGORIES.filter((category) => category.collection === collection)
}
