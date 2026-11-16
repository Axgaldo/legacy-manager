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
 * Canonical categories used by the app. The three primary collections
 * (Numismática, Arte and Objetos) group all of them on the Bienes landing page.
 */
export const ASSET_CATEGORIES: AssetCategoryInfo[] = [
  { value: 'numismatica', label: 'Numismática', icon: '🪙', collection: 'numismatica' },
  { value: 'arte', label: 'Arte y cuadros', icon: '🎨', collection: 'arte' },
  { value: 'objetos', label: 'Objetos diversos', icon: '📦', collection: 'objetos' },
  { value: 'relojes', label: 'Relojes', icon: '⌚', collection: 'objetos' },
  { value: 'joyas', label: 'Joyas', icon: '💎', collection: 'objetos' },
  { value: 'electronica', label: 'Electrónica', icon: '📺', collection: 'objetos' },
  { value: 'vehiculos', label: 'Vehículos', icon: '🚗', collection: 'objetos' },
  { value: 'libros', label: 'Libros', icon: '📚', collection: 'objetos' },
  { value: 'sellos', label: 'Sellos', icon: '✉️', collection: 'objetos' },
  { value: 'instrumentos-musicales', label: 'Instrumentos musicales', icon: '🎸', collection: 'objetos' },
  { value: 'deportes', label: 'Deporte', icon: '⚽', collection: 'objetos' },
  { value: 'herramientas', label: 'Herramientas', icon: '🛠️', collection: 'objetos' },
  { value: 'documentos', label: 'Documentos', icon: '📜', collection: 'objetos' },
  { value: 'coleccionables', label: 'Coleccionismo', icon: '🧸', collection: 'objetos' },
  { value: 'otros', label: 'Otros', icon: '📦', collection: 'objetos' },
]

export const PRIMARY_COLLECTIONS: CollectionInfo[] = [
  { key: 'numismatica', label: 'Numismática', icon: '🪙', description: 'Monedas, billetes y medallas' },
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
  watches: 'relojes',
  jewelry: 'joyas',
  electronics: 'electronica',
  computers: 'electronica',
  vehicles: 'vehiculos',
  books: 'libros',
  stamps: 'sellos',
  'musical-instruments': 'instrumentos-musicales',
  sports: 'deportes',
  tools: 'herramientas',
  documents: 'documentos',
  collectibles: 'coleccionables',
  other: 'otros',
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
