import {
  collection,
  doc,
  addDoc,
  getDocs,
  setDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subscribeToCollection } from '@/lib/firestoreSubscriptions'
import { AssetItem } from '@/types'
import { cleanPayload } from '@/utils/cleanPayload'
import { asNumber, asNumberArray, asString, asStringArray } from '@/utils/coerce'
import { deletePrivateStorageFile, isStoragePath, MAX_ASSET_IMAGE_BYTES, uploadPrivateStorageBlob } from '@/lib/storageFiles'
import { normalizeAssetCategory } from './assetCategories'

const COLLECTION_NAME = 'assets'

export function subscribeToAssets(
  onSuccess: (assets: AssetItem[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeToCollection<AssetItem>({
    name: COLLECTION_NAME,
    constraints: [orderBy('createdAt', 'desc')],
    // Los bienes en la papelera (soft delete) no llegan a las listas.
    filter: (data) => !data.deletedAt,
    map: (id, data) => ({
      id,
      name: asString(data.name),
      owner: asString(data.owner, 'Gabriel'),
          category: normalizeAssetCategory(data.category),
          tags: Array.isArray(data.tags)
            ? asStringArray(data.tags)
            : asStringArray([data.brandOrAuthor, data.material, data.historicalEra, data.country, data.ruler, data.mint, data.denomination, data.conservationState]).filter((tag) => tag.trim().length > 0),
          description: asString(data.description),
          year: asNumber(data.year),
          historicalEra: asString(data.historicalEra),
          country: asString(data.country),
          placeOfOrigin: asString(data.placeOfOrigin) || asString(data.country),
          brandOrAuthor: asString(data.brandOrAuthor),
          ruler: asString(data.ruler),
          mint: asString(data.mint),
          denomination: asString(data.denomination),
          conservationState: asString(data.conservationState),
          material: asString(data.material),
          acquisitionYear: asNumber(data.acquisitionYear),
          acquisitionPrice: asNumber(data.acquisitionPrice),
          currentValue: asNumber(data.currentValue),
          notes: asString(data.notes),
          photos: asStringArray(data.photos),
          photoSizesBytes: asNumberArray(data.photoSizesBytes),
          deletedAt: data.deletedAt || undefined,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,

          // Numismática fields (previously stored documents keep working)
          numismatica_type: data.numismatica_type === 'medalla'
            ? 'medalla'
            : data.numismatica_type === 'moneda'
              ? 'moneda'
              : (data.category === 'medals' || data.category === 'medallas' ? 'medalla' : undefined),
          medal_motive: asString(data.medal_motive),
          medal_size_mm: asString(data.medal_size_mm),
          acquisition_operation: asString(data.acquisition_operation),
          acquisition_source: asString(data.acquisition_source),
          medal_location: asString(data.medal_location),
          value: asNumber(data.value),
          market_value: asNumber(data.market_value),
          value_source: asString(data.value_source),
          purchase_price: asNumber(data.purchase_price),
          purchase_price_original: asNumber(data.purchase_price_original),
          purchase_currency: asString(data.purchase_currency),
          purchase_year: asNumber(data.purchase_year),
          obverse_info: asString(data.obverse_info),
          reverse_info: asString(data.reverse_info),
          era: asString(data.era),
          creation_year_range: asString(data.creation_year_range),
          reference_book: asString(data.reference_book),
          reference_book_value: asNumber(data.reference_book_value),
          reference_book_value_original: asNumber(data.reference_book_value_original),
          reference_book_currency: asString(data.reference_book_currency),
          empire_reign: asString(data.empire_reign),
          manufacturing_place: asString(data.manufacturing_place),
          mint_mark: asString(data.mint_mark),
          weight_grams: asString(data.weight_grams),
          diameter_mm: asString(data.diameter_mm),
          inventory_number: asString(data.inventory_number),
          catalog_reference: asString(data.catalog_reference),
          case_location: asString(data.case_location),
          case_number: asString(data.case_number),
          added_date: asString(data.added_date),
          import_key: asString(data.import_key),
          import_batch: asString(data.import_batch),
          import_source: asString(data.import_source),
          import_row: asNumber(data.import_row),
    }),
    onSuccess,
    onError,
  })
}

export async function createAsset(
  asset: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const assetRef = doc(collection(db, COLLECTION_NAME))
  const stored = await storeAssetPhotos(assetRef.id, asset.photos ?? [])
  try {
    await setDoc(assetRef, {
      ...cleanPayload({ ...asset, photos: stored.paths, photoSizesBytes: stored.sizes }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return assetRef
  } catch (error) {
    await removeUploadedFiles(stored.uploadedPaths)
    throw error
  }
}

/**
 * Crea una copia editable de una ficha: mismos datos, nombre con «(copia)» y
 * sin fotos (las originales pertenecen al bien de origen). Devuelve el id del
 * nuevo documento para poder abrir su ficha en cuanto llegue del snapshot.
 */
export async function duplicateAsset(asset: AssetItem): Promise<string> {
  const { id, createdAt, updatedAt, photos, photoSizesBytes, import_key, deletedAt, ...payload } = asset
  const copy: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'> = {
    ...payload,
    name: `${asset.name} (copia)`,
    photos: [],
    photoSizesBytes: [],
  }
  const ref = await createAsset(copy)
  return ref.id
}

export async function updateAsset(
  id: string,
  asset: Partial<Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>>,
  previousPhotos: string[] = [],
  previousPhotoSizes: number[] = [],
) {
  const docRef = doc(db, COLLECTION_NAME, id)
  const stored = await storeAssetPhotos(id, asset.photos ?? [], previousPhotos, previousPhotoSizes)
  try {
    await backupLegacyPhotos(id, asset.photos ?? [])
    const cleaned = cleanPayload({ ...asset, photos: stored.paths, photoSizesBytes: stored.sizes })
    await updateDoc(docRef, { ...cleaned, updatedAt: serverTimestamp() })
  } catch (error) {
    await removeUploadedFiles(stored.uploadedPaths)
    throw error
  }
  const retained = new Set(stored.paths)
  await Promise.allSettled(previousPhotos.filter(isStoragePath).filter((path) => !retained.has(path)).map(deletePrivateStorageFile))
}

export async function migrateLegacyAssetPhotos(onProgress?: (done: number, total: number) => void) {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME))
  const legacyAssets = snapshot.docs.filter((item) => Array.isArray(item.data().photos) && item.data().photos.some((photo: unknown) => typeof photo === 'string' && photo.startsWith('data:image/')))
  let done = 0
  for (const item of legacyAssets) {
    const data = item.data()
    await updateAsset(item.id, { photos: data.photos, photoSizesBytes: data.photoSizesBytes ?? [] }, data.photos, data.photoSizesBytes ?? [])
    done++
    onProgress?.(done, legacyAssets.length)
  }
  return { migratedAssets: done, totalAssets: legacyAssets.length }
}

async function storeAssetPhotos(assetId: string, photos: string[], existingPhotos: string[] = [], existingSizes: number[] = []) {
  const paths: string[] = []
  const sizes: number[] = []
  const uploadedPaths: string[] = []
  const sizeByPath = new Map(existingPhotos.map((path, index) => [path, existingSizes[index] ?? 0]))
  try {
    for (let index = 0; index < photos.length; index++) {
      const photo = photos[index]
      if (isStoragePath(photo)) {
        paths.push(photo)
        sizes.push(sizeByPath.get(photo) ?? 0)
        continue
      }
      const blob = await dataUrlToBlob(photo)
      if (blob.size > MAX_ASSET_IMAGE_BYTES) throw new Error(`La imagen comprimida ${index + 1} supera el límite de 2 MiB.`)
      const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
      const path = `assets/${assetId}/${crypto.randomUUID()}.${extension}`
      const size = await uploadPrivateStorageBlob(path, blob, blob.type)
      uploadedPaths.push(path); paths.push(path); sizes.push(size)
    }
    return { paths, sizes, uploadedPaths }
  } catch (error) {
    await removeUploadedFiles(uploadedPaths)
    throw error
  }
}

async function dataUrlToBlob(value: string): Promise<Blob> {
  if (!value.startsWith('data:image/')) throw new Error('Una fotografía no tiene un formato de imagen válido.')
  const response = await fetch(value)
  return response.blob()
}

async function backupLegacyPhotos(assetId: string, photos: string[]) {
  const legacyPhotos = photos.map((source, position) => ({ source, position })).filter(({ source }) => source.startsWith('data:image/'))
  await Promise.all(legacyPhotos.map(({ source, position }) => addDoc(collection(db, 'assetPhotoBackups', assetId, 'photos'), {
    source,
    position,
    backedUpAt: serverTimestamp(),
  })))
}

async function removeUploadedFiles(paths: string[]) {
  await Promise.allSettled(paths.map(deletePrivateStorageFile))
}
